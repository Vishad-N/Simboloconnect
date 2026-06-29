const { Queue, Worker } = require('bullmq');
const redisConnection = require('../services/redisConnection');

// Create a Queue for Whatsapp message broadcasts
const messageQueue = new Queue('whatsapp-broadcasts', { connection: redisConnection });

// Initialize an empty worker (will add logic later)
const messageWorker = new Worker('whatsapp-broadcasts', async job => {
    // Logic to send actual whatsapp message using Axios / Meta API
    console.log('Processing job:', job.id, job.data);
    // ... Meta API calling logic here
}, { connection: redisConnection });

messageWorker.on('completed', job => {
    console.log(`${job.id} has completed!`);
});

messageWorker.on('failed', (job, err) => {
    console.log(`${job.id} has failed with ${err.message}`);
});

module.exports = { messageQueue };
