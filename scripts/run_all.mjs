#!/usr/bin/env node

import { exec } from 'child_process';

console.log('Starting dev server...');

const server = exec('npm run dev', {
  cwd: 'C:\\Users\\khamis\\Documents\\nutrio',
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
  
  test.on('close', (code) => {
    console.log(`Test process exited with code ${code}`);
    server.kill();
  });
}, 10000);
