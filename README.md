
# API Calypso

API Calypso est une application Express.js qui expose des endpoints pour récupérer du contenu depuis Calypso ou pour
utiliser certaines de ses fonctionnalités.

Pour l'instant, la récupération des images vedettes de Calypso
est supportée.

## Prérequis

- [Node.js](https://nodejs.org/) installé sur votre machine
- Accès à un serveur DSpace Calypso

## Installation

1. Clonez le repository :

    ```bash
    git clone <URL_DU_REPOSITORY>
    ```

2. Accédez au répertoire du projet :

    ```bash
    cd calypso-api
    ```

3. Installez les dépendances :

    ```bash
    npm install
    ```

## Configuration

1. Ouvrez le fichier `config.js`.

2. Modifiez les variables `apiCalypsoUrl` et `port` avec vos vrais données.

## Démarrage

```bash
npm start
```

Le serveur démarrera sur le port 3000. Vous pouvez accéder aux endpoints comme suit :

- [http://localhost:3000/api/vedette](http://localhost:3000/api/items/vedette) pour récupérer les items vedettes.
- [http://localhost:3000/api/vedette/scope?collection_id=VOTRE_COLLECTION_ID](http://localhost:3000/api/items/vedette/scope?collection_id=VOTRE_COLLECTION_ID) pour récupérer les items vedettes avec le paramètre de collection_id.

## Usage

- Accédez aux endpoints avec votre navigateur ou utilisez un outil comme [Postman](https://www.postman.com/) pour tester les requêtes.

