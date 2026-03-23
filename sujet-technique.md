# Partie 1 : Code Review & Challenge (Typescript) - 20 minutes

**Contexte :**
Un développeur junior de l'équipe a écrit une Lambda en TypeScript destinée à générer une "vidéo journalière" (timelapse) pour une caméra donnée. Cette fonction est déclenchée chaque nuit par un événement CloudWatch (EventBridge) avec l'ID de la caméra.
Le code fonctionne pour les tests locaux avec peu d'images, mais pose problème en production.

**Ta mission :**
Analyse le code ci-dessous. Identifie les problèmes critiques (performance, coût AWS, sécurité, fiabilité) et explique comment tu les corrigerais.

```typescript
import { S3 } from 'aws-sdk';
import * as child_process from 'child_process';
import * as fs from 'fs';

const s3 = new S3({ region: 'eu-west-3' });
const BUCKET_NAME = 'vizzia-camera-raw-images-prod';

export const handler = async (event: any) => {
  const cameraId = event.cameraId; // ex: "cam-123"
  const date = new Date().toISOString().split('T')[0]; // "2023-10-27"

  // 1. Lister toutes les images de la journée
  const listParams = {
    Bucket: BUCKET_NAME,
    Prefix: `${cameraId}/${date}/`
  };
  
  const data = await s3.listObjectsV2(listParams).promise();
  
  if (!data.Contents || data.Contents.length === 0) {
    return { statusCode: 404, body: 'No images found' };
  }

  // 2. Télécharger les images
  for (const item of data.Contents) {
    if (item.Key) {
      const imgObj = await s3.getObject({ Bucket: BUCKET_NAME, Key: item.Key }).promise();
      const fileName = item.Key.split('/').pop();
      fs.writeFileSync(`/tmp/${fileName}`, imgObj.Body as Buffer);
    }
  }

  // 3. Lancer FFMPEG pour créer la vidéo
  // Supposons que ffmpeg est disponible dans le layer Lambda
  try {
    child_process.execSync(`ffmpeg -framerate 15 -pattern_type glob -i '/tmp/*.jpg' -c:v libx264 /tmp/output.mp4`);
  } catch (e) {
    console.log("Error encoding video");
  }

  // 4. Uploader la vidéo
  const videoFile = fs.readFileSync('/tmp/output.mp4');
  await s3.putObject({
    Bucket: BUCKET_NAME,
    Key: `videos/${cameraId}/${date}.mp4`,
    Body: videoFile,
    ACL: 'public-read' 
  }).promise();

  return { statusCode: 200, body: 'Video generated' };
};
```

# Partie 1 : Code Review & Challenge (Go) - 20 minutes

**Contexte :**
L'équipe backend a développé un microservice en Go déployé sur AWS Lambda. Ce service est déclenché quotidiennement pour assembler les images JPEG d'une caméra en une vidéo MP4.
Le code compile et "fonctionne" sur le poste du développeur, mais en production, il est lent et plante souvent avec des erreurs de mémoire ou de timeout.

**Ta mission :**
Analyse le code source ci-dessous. Fais une "Review" comme si tu parlais à un collègue junior. Identifie les problèmes de **concurrence**, **gestion mémoire**, **bonnes pratiques AWS** et **robustesse**.

```go
package main

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
)

const BUCKET_NAME = "vizzia-camera-raw-images-prod"

type Event struct {
	CameraID string `json:"cameraId"`
}

func HandleRequest(ctx context.Context, event Event) (string, error) {
	sess := session.Must(session.NewSession(&aws.Config{
		Region: aws.String("eu-west-3"),
	}))
	svc := s3.New(sess)

	date := time.Now().Format("2006-01-02")
	prefix := fmt.Sprintf("%s/%s/", event.CameraID, date)

	// 1. Lister les objets
	input := &s3.ListObjectsV2Input{
		Bucket: aws.String(BUCKET_NAME),
		Prefix: aws.String(prefix),
	}

	result, err := svc.ListObjectsV2(input)
	if err != nil {
		return "Error listing", err
	}

	// 2. Téléchargement des images
	for _, item := range result.Contents {
		obj, err := svc.GetObject(&s3.GetObjectInput{
			Bucket: aws.String(BUCKET_NAME),
			Key:    item.Key,
		})
		if err != nil {
			fmt.Println("Error downloading image:", err)
			continue
		}
		defer obj.Body.Close()

		parts := strings.Split(*item.Key, "/")
		fileName := parts[len(parts)-1]
		localPath := "/tmp/" + fileName

		outFile, _ := os.Create(localPath)
		
		io.Copy(outFile, obj.Body)
		outFile.Close()
	}

	// 3. Exécution FFMPEG
	cmd := exec.Command("ffmpeg", "-y", "-framerate", "15", "-i", "/tmp/*.jpg", "/tmp/output.mp4")
	output, err := cmd.CombinedOutput()
	if err != nil {
		fmt.Printf("FFMPEG Error: %s\n", string(output))
		return "Encoding failed", err
	}

	// 4. Upload du résultat
	videoFile, _ := os.Open("/tmp/output.mp4")
	defer videoFile.Close()

	_, err = svc.PutObject(&s3.PutObjectInput{
		Bucket: aws.String(BUCKET_NAME),
		Key:    aws.String(fmt.Sprintf("videos/%s/%s.mp4", event.CameraID, date)),
		Body:   videoFile,
		ACL:    aws.String("public-read"),
	})

	if err != nil {
		return "Upload failed", err
	}

	return "Success", nil
}

func main() {
	lambda.Start(HandleRequest)
}
```

# Partie 1 : Code Review & Challenge (Python) - 20 minutes

**Contexte :**
Une fonction AWS Lambda écrite en Python 3.9 est chargée de compiler les images de la journée. Le code utilise la librairie standard `boto3`.
L'infrastructure actuelle rapporte que pour certaines caméras, la vidéo finale est tronquée (il manque la fin de la journée) et que les coûts d'exécution Lambda explosent.

**Ta mission :**
Analyse le code ci-dessous. Identifie les erreurs de **logique AWS**, de **performance Python**, de **sécurité** et de **gestion du cycle de vie Lambda**.

```python
import json
import boto3
import os
import subprocess

def lambda_handler(event, context):
    s3_client = boto3.client('s3', region_name='eu-west-3')
    
    bucket_name = 'vizzia-camera-raw-images-prod'
    camera_id = event.get('cameraId')
    date_str = event.get('date') # Format attendu "YYYY-MM-DD"
    
    prefix = f"{camera_id}/{date_str}/"
    
    # 1. Lister les images
    response = s3_client.list_objects_v2(
        Bucket=bucket_name,
        Prefix=prefix
    )
    
    if 'Contents' not in response:
        return {'statusCode': 404, 'body': 'No images'}

    # 2. Téléchargement des images
    download_dir = '/tmp/images'
    if not os.path.exists(download_dir):
        os.makedirs(download_dir)

    for item in response['Contents']:
        key = item['Key']
        filename = key.split('/')[-1]
        local_path = f"{download_dir}/{filename}"
        s3_client.download_file(bucket_name, key, local_path)

    # 3. Encodage Vidéo avec FFMPEG
    output_path = f"/tmp/{camera_id}_{date_str}.mp4"
    
    command = f"ffmpeg -r 15 -pattern_type glob -i '{download_dir}/*.jpg' -c:v libx264 {output_path}"
    subprocess.call(command, shell=True)

    # 4. Upload
    s3_client.upload_file(
        output_path, 
        bucket_name, 
        f"videos/{camera_id}/{date_str}.mp4",
        ExtraArgs={'ACL': 'public-read'}
    )
    
    return {
        'statusCode': 200,
        'body': json.dumps('Video created successfully')
    }
```

---

# Partie 2 : System Design & Architecture (40 minutes)

**Sujet : "Scalabilité et Fiabilité de l'Ingestion Vidéo IoT"**

**Mise en situation :**
Vizzia prévoit de passer de 500 à **5 000 caméras** dans les 12 prochains mois. Les clients se plaignent actuellement de deux problèmes majeurs :
1.  **Trous dans les timelapses :** Certaines images manquent car la connexion 4G des chantiers est instable.
2.  **Lenteur de demande d'extrait :** Quand un client demande un extrait vidéo (ex: "Montrez-moi ce qu'il s'est passé mardi dernier entre 14h00 et 14h30"), le système actuel met trop de temps à répondre.

**Tes objectifs :**
Dessine et commente l'architecture cible sur AWS pour répondre à ces enjeux.

**Contraintes techniques à respecter :**
*   **Ingestion :** Chaque caméra envoie 1 image/minute (JPEG ~500KB).
*   **Réseau :** Les caméras sont sur des réseaux 4G privés ou publics (NAT). Elles ont un buffer local de 48h.
*   **Stockage :** Il faut garder les images brutes pendant 1 an (obligation contractuelle), mais optimiser les coûts.
*   **Réglementation (RGPD) :** Les visages doivent être floutés si une personne passe devant la caméra avant que l'image ne soit accessible aux clients.
*   **Accès :** Le client utilise une WebApp pour demander ses vidéos.

**Questions directrices pour l'entretien :**

1.  **Stratégie d'Ingestion :**
    *   Comment les caméras envoient-elles les images ? (S3 Direct Upload ? API Gateway ? IoT Core ?)
    *   Comment gères-tu la réconciliation des images manquantes (backfill) quand la 4G revient après une coupure ?

2.  **Traitement (Compute) :**
    *   Où et comment exécutes-tu le floutage des visages (GDPR) ? À la volée ou en asynchrone ?
    *   Quel service AWS utilises-tu pour générer les extraits vidéos à la demande (Lambda, Fargate, Batch, MediaConvert) ? Justifie ton choix par rapport aux coûts et à la latence.

3.  **Stockage & Coûts :**
    *   5000 caméras * 1440 images/jour * 500KB. Fais une estimation rapide du volume.
    *   Quelle stratégie de stockage (S3 Tiering) proposes-tu pour optimiser la facture tout en gardant les données 1 an ?

4.  **Sécurité :**
    *   Comment authentifies-tu les caméras (mTLS, IAM keys, Presigned URLs) ?
    *   Comment garantis-tu que le client A ne puisse jamais demander la vidéo de la caméra du client B ?

Prépare-toi à dessiner l'architecture au tableau (ou sur un outil de diagramme) en expliquant le flux de données de la caméra jusqu'à l'écran du client.

# Pistes de reflexion

## Partie 1 - Typescript

**Pistes de réflexion pour toi (à ne pas lire pendant l'exercice, mais pour ta préparation) :**
*   *AWS SDK V2 vs V3.*
*   *Gestion de la mémoire (/tmp) et nettoyage.*
*   *Timeout Lambda (1440 images à télécharger + traitement vidéo).*
*   *Limites de `listObjectsV2` (pagination ?).*
*   *Sécurité (ACL public, Hardcoded bucket).*
*   *Sync vs Async.*

## Partie 1 - Go

**Pistes de réflexion spécifiques au Go et AWS (pour ta préparation) :**

1.  **Concurrence (Go Routines) :** Le code télécharge les images une par une (`for` loop). En Go, c'est une hérésie. On attendrait l'utilisation de `goroutines` avec un `sync.WaitGroup` ou une `Worker Pool` pour paralléliser les téléchargements (ex: télécharger 20 images en parallèle).
2.  **AWS SDK Session :** La session `s3.New` est créée *dans* le handler. Elle devrait être initialisée dans une variable globale (`init()` ou variable package-level) pour être réutilisée entre les invocations de la Lambda (Warm start).
3.  **Gestion du `defer` dans une boucle :** Le `defer obj.Body.Close()` est exécuté à la *fin de la fonction*, pas à la fin de l'itération de la boucle. Cela crée une fuite de mémoire et de descripteurs de fichiers (file handles) tant que la boucle n'est pas finie.
4.  **Pagination S3 :** `ListObjectsV2` renvoie max 1000 objets. Si la caméra a 1440 images, le code actuel loupera les 440 dernières images car il ne vérifie pas `IsTruncated` et ne gère pas le `ContinuationToken`.
5.  **Sécurité :** `ACL: public-read` rend la vidéo accessible à tout internet. C'est une faille majeure.
6.  **Gestion des erreurs :** Beaucoup d'erreurs sont ignorées (assignées à `_`), ce qui rend le débogage impossible en cas de disque plein (`/tmp` est limité à 512MB-10GB selon la config) ou de problème réseau.

## Partie 1 - Python

**Pistes de réflexion spécifiques à Python et AWS (Cheatsheet) :**

1.  **Pagination S3 (`list_objects_v2`) :** C'est l'erreur la plus probable pour le problème de "vidéo tronquée". `list_objects_v2` retourne maximum 1000 objets par défaut. Avec 1440 images/jour, le code rate les 440 dernières. Il faut utiliser un `Paginator` boto3 ou vérifier `IsTruncated` et utiliser le `NextContinuationToken`.
2.  **Performance (Concurrency) :** Python est synchrone (Global Interpreter Lock - GIL), mais pour des tâches I/O (réseau) comme télécharger 1000 fichiers, le multithreading fonctionne très bien. Tu devrais suggérer l'utilisation de `concurrent.futures.ThreadPoolExecutor` pour télécharger les images en parallèle et diviser le temps d'exécution par 10.
3.  **Initialisation du Client (`boto3.client`) :** Le client S3 est recréé à chaque invocation. Il faut le sortir du `lambda_handler` pour profiter du "Warm Start" (réutilisation du conteneur Lambda) et gagner quelques millisecondes/connexions.
4.  **Espace Disque `/tmp` :** Les conteneurs Lambda sont réutilisés. Si on ne nettoie pas `/tmp` à la fin (`shutil.rmtree`), le disque va se remplir après quelques exécutions consécutives, causant un crash "No space left on device".
5.  **Sécurité (`shell=True`) :** Utiliser `subprocess.call` avec une string et `shell=True` est risqué si les variables (ici `download_dir` ou noms de fichiers) sont compromises. Il vaut mieux passer une liste d'arguments : `['ffmpeg', '-r', '15', ...]`.
6.  **Sécurité (ACL Public) :** Comme pour les autres langages, `ACL='public-read'` expose les données privées de Vizzia à tout Internet.

C'est parfait pour montrer que tu maîtrises non seulement le code, mais aussi l'environnement d'exécution (Runtime AWS) et les pièges classiques de l'infrastructure Cloud.
