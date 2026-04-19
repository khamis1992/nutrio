#!/usr/bin/env node

const { exec } = require('child_process');
const time = require('time');

console.log('Starting dev server...');

const server = exec('npm run dev', {
  cwd: 'C:\\Users\\khamis\\Documents\\nutrio',
  timeout: 10000,
  env: process.env
});

server.stdout.on('data', (data) => {
  console.log(data.toString());
});

setTimeout(() => {
  console.log('Starting tests...');
  const test = exec('python scripts/final_test.py', {
    cwd: 'C:\\Users\\khamis\\Documents\\nutrio',
    env: process.env
  });
  
  test.stdout.on('data', (data) => {
    console.log(data.toString());
  });
  
  test.stderr.on('data', (data) => {
    console.error(data.toString());
  });
  
  test.on('close', (code) => {
    console.log(`Test process exited with code ${code}`);
    server.kill();
  });
}, 8000);
