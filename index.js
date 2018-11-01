/** 
 * Triggered from a change to a Cloud Storage bucket.
 *
 * @param {!Object} event Event payload and metadata.
 * @param {!Function} callback Callback function to signal completion.
 */
// Imports the Google Cloud client library
const PubSub = require('@google-cloud/pubsub');
const vision = require('@google-cloud/vision').v1;
const pdfText = require('pdf-text');

const gcs = require('@google-cloud/storage')();
const path = require('path');
const os = require('os');
const fs = require('fs');

// Imports the Google Cloud client libraries

// Creates a client
const client = new vision.ImageAnnotatorClient();

// Creates a client
const pubsub = new PubSub();


function publish(data, bucket) {
    const topicName = process.env.topicName;
    const dataBuffer = Buffer.from(data);

    const customAttributes = {
        origin: 'pdf-to-text',
        bucket: bucket
    };

    pubsub
        .topic(topicName)
        .publisher()
        .publish(dataBuffer, customAttributes)
        .then(results => {
            const messageId = results[0];
            console.log(`Message ${messageId} published.`);
        })
        .catch(err => {
            console.error('ERROR:', err);
        });
}

exports.parsePDF = (data, context) => {
    console.log(data);
    const file = data;
    const fileBucket = file.bucket;
    const filePath = file.name;
    const contentType = file.contentType;

    console.log(`Processing file: ${file.name}`);
    console.log(contentType);
    if (!contentType.endsWith('pdf')) {
        console.log('This is not a pdf.');
        return null;
    }

    const fileName = path.basename(filePath);
    console.log(`fileName: ${fileName}`);
    const bucket = gcs.bucket(fileBucket);
    console.log(`bucket: ${bucket}`);

    console.log("Downloading file.");

    const gcsSourceUri = `gs://${bucket}/${fileName}`;
    const gcsDestinationUri = `gs://${bucket}/${fileName}.json`;

    const inputConfig = {
        // Supported mime_types are: 'application/pdf' and 'image/tiff'
        mimeType: 'application/pdf',
        gcsSource: {
            uri: gcsSourceUri,
        },
    };
    const outputConfig = {
        gcsDestination: {
            uri: gcsDestinationUri,
        },
    };
    const features = [{ type: 'DOCUMENT_TEXT_DETECTION' }];
    const request = {
        requests: [{
            inputConfig: inputConfig,
            features: features,
            outputConfig: outputConfig,
        }, ],
    };

    return client
        .asyncBatchAnnotateFiles(request)
        .then(results => {
            const operation = results[0];
            // Get a Promise representation of the final result of the job
            return operation.promise();
        })
        .then(filesResponse => {
            const destinationUri =
                filesResponse[0].responses[0].outputConfig.gcsDestination.uri;
            console.log('Json saved to: ' + destinationUri);
        })
        .catch(err => {
            console.error('ERROR:', err);
        });
};