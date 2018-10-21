/** 
 * Triggered from a change to a Cloud Storage bucket.
 *
 * @param {!Object} event Event payload and metadata.
 * @param {!Function} callback Callback function to signal completion.
 */
// Imports the Google Cloud client library
const PubSub = require('@google-cloud/pubsub');

const gcs = require('@google-cloud/storage')();
const path = require('path');
const os = require('os');
const fs = require('fs');
const pdfText = require('pdf-text');


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

exports.parsePDF = (event, callback) => {
  const file = event.data;
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
  const tempFilePath = path.join(os.tmpdir(), fileName);
  console.log(`tempFilePath: ${tempFilePath}`);
  console.log("Downloading file.");

  bucket.file(filePath).download({
    destination: tempFilePath,
  }).then(() => {
    console.log("Reading File");
    
    var buffer = fs.readFileSync(tempFilePath)
    
    console.log('Image downloaded locally to', tempFilePath);
    
    pdfText(buffer, function (err, chunks) {
      console.log("PDF convertion done.")
      if (err) {
        console.error('ERROR:', err);
      } else {
        console.log(chunks);
        publish(chunks.join(' '), fileBucket);
      }
      callback();
    });
  }).catch((error) => { 
    console.log(error) 
  });
};
