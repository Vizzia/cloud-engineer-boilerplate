# Admin - Preparation avant entretien

Guide pour préparer l'environnement AWS sandbox avant un entretien technique.

## Pré-requis

- AWS CLI configuré avec un profil `sandbox` ayant les droits IAM admin
- Ce repository cloné localement

## Avant l'entretien

### 1. Créer un utilisateur temporaire pour le candidat

```bash
make create name=<prenom-nom>
```

Cela va :
- Créer un utilisateur IAM `candidate-<prenom-nom>`
- Lui attacher les policies `PowerUserAccess` et `IAMFullAccess`
- Générer des access keys et les écrire dans le fichier `.env`

### 2. Vérifier que les credentials fonctionnent

```bash
export $(cat .env | xargs)
aws sts get-caller-identity
```

Le résultat doit afficher l'ARN de l'utilisateur `candidate-<prenom-nom>`.

### 3. Transmettre au candidat

Envoyer au candidat :
- Le lien vers le repository (ou un fork dédié)
- Le contenu du fichier `.env` (AccessKeyId, SecretAccessKey, Region)
- Les instructions pour configurer son environnement :

```bash
aws configure --profile sandbox
# AWS Access Key ID: <fourni>
# AWS Secret Access Key: <fourni>
# Default region name: eu-west-1
# Default output format: json
```

## Après l'entretien

### 1. Détruire les stacks déployés par le candidat

```bash
npx cdk destroy --all --profile sandbox
```

### 2. Supprimer l'utilisateur temporaire

```bash
make delete name=<prenom-nom>
```

Cela va automatiquement supprimer les access keys, détacher les policies et supprimer l'utilisateur.

### 3. Vérifier le nettoyage

```bash
# Vérifier qu'il ne reste pas de ressources orphelines
aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE \
  --profile sandbox --query 'StackSummaries[].StackName'
```

## Résumé des commandes

| Etape | Commande |
|-------|----------|
| Créer un candidat | `make create name=<nom>` |
| Supprimer un candidat | `make delete name=<nom>` |
| Tester les credentials | `export $(cat .env \| xargs) && aws sts get-caller-identity` |
| Déployer les stacks | `npx cdk deploy --all --profile sandbox` |
| Détruire les stacks | `npx cdk destroy --all --profile sandbox` |
