const express = require('express');
const axios = require('axios');
const winston = require('winston');
const config = require('./config');
const cors = require('cors');
// AJOUTER pour Lambda
const serverless = require('serverless-http'); 


const app = express();
const port = config.port;

// Utilisez CORS middleware
const corsOptions = {
    origin: config.uiCollspecUrl,
    methods: 'GET,PUT,POST,DELETE',
    credentials: true,
    optionsSuccessStatus: 204,
    allowedHeaders: 'Content-Type, x-correlation-id, x-referrer, Authorization'
};

app.use(cors(corsOptions));

app.use(express.json());

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', config.uiCollspecUrl);
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-correlation-id, Authorization');
    next();
});

// Configuration des logs avec winston
const logger = winston.createLogger({
    transports: [
        new winston.transports.File({
            level: 'error',
            filename: config.logsRep,
            format: winston.format.combine(winston.format.timestamp(), winston.format.json())
        })
    ]
});

// Middleware d'erreur
app.use((err, req, res, next) => {
    console.error('Erreur globale :', err); 
    logger.error(`Erreur globale : ${err.message}`);
    res.status(500).json({ error: 'Erreur serveur' });
    next();
});




// Endpoint pour récupérer les items vedettes
app.get('/api/vedette', async (req, res) => {
    const apiUrl = `${config.apiCollspecUrl}${config.vedetteGlobale}`;

    try {
        const featuredItems = await getFeaturedItems(apiUrl, null);
        // Mélanger le tableau d'items vedettes
        const shuffledFeaturedItems = shuffleArray(featuredItems);
        res.json({ items: shuffledFeaturedItems });
    } catch (error) {
        logger.error(`Erreur lors de la récupération des données : ${error.message}`);
        handleRequestError(res, '', error);
    }
});


// Endpoint pour récupérer les items vedettes pour une collection ou communité donnée
app.get('/api/vedette/:scope', async (req, res) => {
    const scope = req.params.scope;
    const apiUrl = `${config.apiCollspecUrl}${config.vedetteScope}&scope=${scope}`;

    try {
        const featuredItems = await getFeaturedItems(apiUrl, scope);
        // Mélanger le tableau d'items vedettes
        const shuffledFeaturedItems = shuffleArray(featuredItems);
        res.json({ items: shuffledFeaturedItems });
    } catch (error) {
        logger.error(`Erreur lors de la récupération des données avec le scope ${scope}: ${error.message}`);
        handleRequestError(res, '', error);
    }
});

// Endpoint pour récupérer un nombre spécifié d'items vedettes au hasard pour une collection donnée
app.get('/api/vedette/:limit/:scope', async (req, res) => {
    const limit = parseInt(req.params.limit);
    const scope = req.params.scope;

    const apiUrl = `${config.apiCollspecUrl}${config.vedetteScope}&scope=${scope}`;

    try {
        const featuredItems = await getFeaturedItems(apiUrl, scope);

        // Mélanger le tableau d'items vedettes
        const shuffledFeaturedItems = shuffleArray(featuredItems);

        // Limiter le nombre d'items vedettes mélangés en fonction du paramètre "limit"
        const limitedShuffledFeaturedItems = shuffledFeaturedItems.slice(0, limit);

        res.json({ items: limitedShuffledFeaturedItems, totalCount: featuredItems.length });
    } catch (error) {
        logger.error(`Erreur lors de la récupération des données avec le scope ${scope}: ${error.message}`);
        handleRequestError(res, '', error);
    }
});


// Fonction pour gérer la demande d'items vedettes
async function handleFeaturedItemsRequest(apiUrl, res, errorMessage) {
    try {
        const featuredItems = await getFeaturedItems(apiUrl, null);
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

        if (bitstreams.length === 0) {
            console.warn(`Aucun bitstream trouvé pour le bundle VEDETTE de l'objet ${idItem}`);
            return { idItem, group: null };
        }

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
async function getFeaturedItems(apiUrl, scope) {
    try {
        const response = await axios.get(apiUrl);

        const discoverObjects = await Promise.all(
            response.data._embedded.searchResult._embedded.objects.map(async obj => {
                try {
                    const { idItem, group } = await getBundleInfo(obj);

                    // Ajoutez cette vérification pour exclure les items qui n'ont pas un bundle VEDETTE
                    if (group !== null) {
                        if(scope!== null){
                            return {
                                id: idItem,
                                title: obj._embedded.indexableObject.metadata['dc.title']?.[0]?.value || null,
                                description: obj._embedded.indexableObject.metadata['dc.description']?.[0]?.value || null,
                                group,
                                scope
                            };
                        }else {
                            return {
                                id: idItem,
                                title: obj._embedded.indexableObject.metadata['dc.title']?.[0]?.value || null,
                                description: obj._embedded.indexableObject.metadata['dc.description']?.[0]?.value || null,
                                group
                            };
                        }

                    } else {
                        console.warn(`Aucune information d'item vedette pour l'objet ${idItem}`);
                        return null;
                    }
                } catch (error) {
                    logger.error(`Erreur lors de la récupération des informations pour l'objet ${obj._embedded.indexableObject.id}:`, error);
                    return null;
                }
            })
        );

        // Filtrer les éléments nuls ici également
        return discoverObjects.filter(item => item !== null);
    } catch (error) {
        logger.error(`Erreur lors de la récupération des données: ${error.message}`);
        throw error;
    }
}

// Fonction pour mélanger les éléments d'un tableau de manière aléatoire
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Fonction pour gérer les erreurs de requête
function handleRequestError(res, errorMessage, error) {
    console.error('Erreur handle :', error); 
    logger.error(`${errorMessage}:`, error);
    res.status(500).json({ error: 'Erreur serveur' });
}


// Route de test
app.get('/health', (req, res) => {
    res.json({ 
        status: 'Hello', 
        timestamp: new Date().toISOString(),
        service: 'API Vedette'
    });
});

// AJOUTER pour Lambda
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route non trouvée' });
});

module.exports.handler = serverless(app);

// Démarrer le serveur en local
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`🚀 Serveur démarré sur le port ${PORT}`);
        console.log(`📡 URL: http://localhost:${PORT}`);
    });
}
