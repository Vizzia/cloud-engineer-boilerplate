# Cloud Engineer - Test Technique

Bienvenue ! Ce repository contient une infrastructure AWS CDK simplifiée que vous allez faire évoluer.

## Stack technique

- **AWS CDK v2** (TypeScript) pour l'Infrastructure as Code
- **Python 3.12** pour les fonctions Lambda
- **Jest** pour les tests unitaires

## Architecture existante

```
bin/
├── app.ts                # Entrypoint CDK
└── environments.ts       # Configuration des environnements (dev/prod)

lib/
├── stage-base.ts         # Stage abstrait (tags, env)
├── main-stage.ts         # Stage principal, instancie les stacks
├── storage-stack/
│   └── storage-stack.ts  # 2 buckets S3 (data + results)
└── processing-stack/
    ├── processing-stack.ts             # Step Function + Lambda
    └── functions/process-data/
        ├── process-data-function.ts    # Construct CDK de la Lambda
        └── code/src/app.py             # Handler Python
```

**Ressources deployées :**
- **S3** : `DataBucket` (versionné, EventBridge activé) + `ResultsBucket`
- **Lambda** : `process-data` - lit depuis DataBucket, écrit dans ResultsBucket
- **Step Function** : `ProcessingStateMachine` - invoque la Lambda puis vérifie le statut

## Commandes utiles

```bash
npm install                  # Installer les dépendances
npm run build                # Compiler TypeScript
npm test                     # Lancer les tests
```

### Déploiement

```bash
npm run build                # Compiler TypeScript (met à jour dist/)

# Lister les stacks disponibles
npx cdk list

# Synthétiser le template CloudFormation
npx cdk synth

# Voir les changements avant déploiement
npx cdk diff --profile sandbox

# Déployer les stacks
npx cdk deploy --all --profile sandbox
```


---

## Scénarios pratiques

Avant toute chose change le prefix dans le fichier `environnement.ts`

### Scénario 1 : Ajouter une étape de validation à la Step Function

**Contexte :** Avant de traiter les données, on souhaite valider le format du fichier d'entrée.

**Objectif :**
1. Créer une nouvelle Lambda Python `validate-data` qui :
   - Lit le fichier depuis le `DataBucket`
   - Vérifie que c'est un JSON valide contenant un champ `records` (liste)
   - Retourne `{ "status": "VALID" }` ou `{ "status": "INVALID", "error": "..." }`
2. Intégrer cette Lambda comme **première étape** de la Step Function existante
3. Si la validation échoue (`INVALID`), la Step Function doit échouer avec un état `Fail`
4. Ajouter un test unitaire vérifiant que la Step Function contient bien 2 invocations Lambda

**Points d'évaluation :**
- Structure du code (nouveau construct, organisation des fichiers)
- Gestion des permissions IAM (principle of least privilege)
- Qualité de la Step Function definition (enchaînement des steps, gestion d'erreurs)

---

### Scénario 2 : Déclencher la Step Function via EventBridge

**Contexte :** On souhaite que la Step Function se déclenche automatiquement quand un fichier `.json` est déposé dans le `DataBucket`.

**Objectif :**
1. Créer une règle EventBridge qui :
   - Se déclenche sur les événements `Object Created` du `DataBucket`
   - Filtre uniquement les fichiers avec le suffixe `.json`
   - Cible la Step Function `ProcessingStateMachine`
2. Passer en input de la Step Function le `key` de l'objet S3 déposé (mapper l'event S3 vers le format attendu par la Lambda `{ "input_key": "<key>" }`)
3. S'assurer que les permissions IAM sont correctement configurées (EventBridge -> Step Function)

**Points d'évaluation :**
- Connaissance d'EventBridge et des event patterns S3
- Capacité à transformer un payload (input transformer)
- Compréhension du modèle de permissions AWS (rôle EventBridge, trust policy)

---

### Scénario 3 : Ajouter un mécanisme de retry et notification d'erreur

**Contexte :** En production, le traitement peut échouer de manière transitoire (timeout S3, throttling). On veut ajouter de la résilience et être alerté en cas d'échec définitif.

**Objectif :**
1. Ajouter un mécanisme de **retry avec backoff exponentiel** sur l'étape `ProcessData` de la Step Function :
   - 3 tentatives maximum
   - Intervalle initial de 5 secondes, backoff rate de 2
   - Ne retenter que sur les erreurs de type `Lambda.ServiceException` et `Lambda.TooManyRequestsException`
2. Créer une **SNS Topic** `processing-alerts` et y envoyer une notification quand la Step Function échoue définitivement
3. Ajouter un **CloudWatch Alarm** qui se déclenche si le taux d'échec de la Step Function dépasse 10% sur une fenêtre de 5 minutes

**Points d'évaluation :**
- Maîtrise des patterns de retry dans Step Functions
- Connaissance de SNS et intégration avec Step Functions
- Capacité à mettre en place du monitoring/alerting avec CloudWatch
- Vision opérationnelle (observabilité, résilience)

---

## Consignes générales

- Respecter les conventions de code existantes (Prettier, ESLint, commit conventionnels)
- Garder la structure modulaire : un construct par fonction, organisé par stack
- Les tests doivent passer (`npm test`)
- `npx cdk synth -c stage=dev` doit fonctionner sans erreur
- Commiter avec des messages clairs suivant le format : `feat: description` / `fix: description`
