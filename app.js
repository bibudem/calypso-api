const express = require('express');
const axios = require('axios');
const config = require('./config'); // Importez le fichier de configuration
const app = express();
const port = config.port;
const apiCalypsoUrl = config.apiCalypsoUrl;

// Requette specifiques
const vedetteGlobale = '%2Evedette%3Atrue';
const vedetteScope = '%2Escopevedette%3Atrue';

// Endpoint pour récupérer les items vedettes
app.get('/api/items/vedette', handleFeaturedItemsRequest);

// Endpoint pour récupérer les items vedettes avec scope
app.get('/api/items/vedette/scope', handleFeaturedScopeItemsRequest);

// Démarrer le serveur
app.listen(port, () => {
    console.log(`Serveur écoutant sur le port ${port}`);
});

// Middleware d'erreur
app.use((err, req, res, next) => {
    console.error('Erreur globale :', err);
    res.status(500).json({ error: 'Erreur serveur' });
    next();
});

// Fonction pour gérer la demande d'items vedettes
async function handleFeaturedItemsRequest(req, res) {
    try {
        const featuredItems = await getFeaturedItems(apiCalypsoUrl + vedetteGlobale);
        res.json({ items: featuredItems });
    } catch (error) {
        handleRequestError(res, 'Erreur lors de la récupération des données', error);
    }
}

// Fonction pour gérer la demande d'items vedettes avec scope
async function handleFeaturedScopeItemsRequest(req, res) {
    try {
        const collectionId = req.query.collection_id;

        if (!collectionId) {
            return res.status(400).json({ error: 'Paramètre collection_id manquant' });
        }

        const apiUrl = `${apiCalypsoUrl}${vedetteScope}&collection_id=${collectionId}`;
        const featuredScopeItems = await getFeaturedItems(apiUrl);
        res.json({ items: featuredScopeItems, collectionId });
    } catch (error) {
        handleRequestError(res, 'Erreur lors de la récupération des données avec scope', error);
    }
}

// Fonction pour récupérer le titre, description, bundle et bitstreams des items vedettes depuis Calypso
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
                console.error(`Erreur lors de la récupération des informations pour l'objet ${obj._embedded.indexableObject.id}:`, error);
                return null;
            }
        })
    );

    return discoverObjects.filter(item => item !== null);
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
        console.error(`Erreur lors de la récupération des bundles pour l'objet ${idItem}:`, error);
        return { idItem, group: null };
    }
}


// Fonction pour gérer les erreurs de requête
function handleRequestError(res, errorMessage, error) {
    console.error(`${errorMessage}:`, error);
    res.status(500).json({ error: 'Erreur serveur' });
}
