const express = require('express');
const axios = require('axios');
const winston = require('winston');
const config = require('./config');

const app = express();
const port = config.port;
const apiCalypsoUrl = config.apiCalypsoUrl;

const vedetteGlobale = '/api/discover/search/objects?query=calypso%2Evedette%3Atrue';
const vedetteScope = '/api/discover/search/objects?query=calypso%2Escopevedette%3Atrue';

// Configuration des logs avec winston
const logger = winston.createLogger({
    transports: [
        new winston.transports.File({
            level: 'error',
            filename: 'logs/error.log',
            format: winston.format.combine(winston.format.timestamp(), winston.format.json())
        })
    ]
});

// Middleware d'erreur
app.use((err, req, res, next) => {
    logger.error(`Erreur globale : ${err.message}`);
    res.status(500).json({ error: 'Erreur serveur' });
    next();
});

// Démarrer le serveur
app.listen(port, () => {
    console.log(`Serveur écoutant sur le port ${port}`);
});

// Endpoint pour récupérer les items vedettes
app.get('/api/vedette', async (req, res) => {
    await handleFeaturedItemsRequest(apiCalypsoUrl + vedetteGlobale, res, 'avec scope');
});

// Endpoint pour récupérer les items vedettes avec scope
app.get('/api/vedette/scope', async (req, res) => {
    const collectionId = req.query.collection_id;

    if (!collectionId) {
        return res.status(400).json({ error: 'Paramètre collection_id manquant' });
    }

    const apiUrl = `${apiCalypsoUrl}${vedetteScope}&collection_id=${collectionId}`;
    await handleFeaturedItemsRequest(apiUrl, res, '');
});

// Fonction pour gérer la demande d'items vedettes
async function handleFeaturedItemsRequest(apiUrl, res, errorMessage) {
    try {
        const featuredItems = await getFeaturedItems(apiUrl);
        res.json({ items: featuredItems });
    } catch (error) {
        logger.error(`Erreur lors de la récupération des données ${errorMessage}: ${error.message}`);
        handleRequestError(res, errorMessage, error);
    }
}

// Fonction pour récupérer les informations du bundle depuis un objet
async function getBundleInfo(obj) {
    const idItem = obj._embedded.indexableObject.id;
    const bundlesUrl = obj._embedded.indexableObject._links.bundles.href;

    try {
        const bundlesResponse = await axios.get(bundlesUrl);
        const bundles = bundlesResponse.data._embedded.bundles;
        const featuredBundle = bundles.find(bundle => bundle.name === 'VEDETTE');

        if (!featuredBundle) {
            console.warn(`Aucun bundle VEDETTE trouvé pour l'objet ${idItem}`);
            return { idItem, group: null };
        }

        const bitstreamsUrl = featuredBundle._links.bitstreams.href;
        const bitstreamsResponse = await axios.get(bitstreamsUrl);
        const bitstreams = bitstreamsResponse.data._embedded.bitstreams;

        const group = {
            name: featuredBundle.name,
            image: bitstreams.map(bitstream => ({
                id: bitstream.id,
                name: bitstream.name,
                url: bitstream._links.content.href,
                sizeBytes: bitstream.sizeBytes
            })),
        };

        return { idItem, group };
    } catch (error) {
        logger.error(`Erreur lors de la récupération des bundles pour l'objet ${idItem}:`, error);
        return { idItem, group: null };
    }
}

// Fonction pour récupérer les items vedettes
async function getFeaturedItems(apiUrl) {
    const response = await axios.get(apiUrl);

    if (!response.data._embedded) {
        console.error('Aucune donnée trouvée dans la réponse de DSpace');
        return [];
    }

    const discoverObjects = await Promise.all(
        response.data._embedded.searchResult._embedded.objects.map(async obj => {
            try {
                const { idItem, group } = await getBundleInfo(obj);
                return {
                    id: idItem,
                    title: obj._embedded.indexableObject.metadata['dc.title']?.[0]?.value || null,
                    description: obj._embedded.indexableObject.metadata['dc.description']?.[0]?.value || null,
                    group,
                };
            } catch (error) {
                logger.error(`Erreur lors de la récupération des informations pour l'objet ${obj._embedded.indexableObject.id}:`, error);
                return null;
            }
        })
    );

    return discoverObjects.filter(item => item !== null);
}

// Fonction pour gérer les erreurs de requête
function handleRequestError(res, errorMessage, error) {
    logger.error(`${errorMessage}:`, error);
    res.status(500).json({ error: 'Erreur serveur' });
}
