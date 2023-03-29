#! /usr/bin/env node

const args = process.argv.slice(2);
if (args.length !== 1) {
  console.log('Usage: create-simple-serverless-app <project-name>');
  process.exit(1);
}

const appName = args[0];

console.log('Create Simple Serverless App');
console.log(`App Name: ${appName}`);

const execSync = require('child_process').execSync;
const fs = require('fs');

const webpackConfig = `const path = require('path');
const slsw = require('serverless-webpack');
const { IgnorePlugin } = require('webpack');

module.exports = {
  mode: 'production',
  entry: slsw.lib.entries,
  resolve: {
    extensions: ['.js', '.json', '.ts', '.tsx'],
  },
  externals: [
    {
      'aws-sdk': 'commonjs aws-sdk',
      '@google-cloud/storage': 'commonjs @google-cloud/storage',
    },
  ],
  output: {
    libraryTarget: 'commonjs',
    path: path.join(__dirname, '.webpack'),
    filename: '[name].js',
  },
  optimization: {
    // Webpack uglify can break mysqljs.
    // https://github.com/mysqljs/mysql/issues/1548
    minimize: false,
  },
  plugins: [
    new IgnorePlugin(/^encoding$/, /node-fetch/)
  ],
  target: 'node',
  module: {
    rules: [
      {
        test: /\\.ts(x?)$/,
        use: [
          {
            loader: 'ts-loader',
          },
        ],
      },
    ],
    noParse: /\\/node_modules\\/encoding\\/lib\\/iconv-loader\\.js$/,
  },
};
`;
const serverlessConfig = `service: ${appName}
provider:
  name: aws
  runtime: nodejs16.x
  versionFunctions: false
  stage: \${env:STAGE}
  region: ap-northeast-2
  iamRoleStatements:
    - Effect: 'Allow'
      Action:
        - 's3:*'
        - 'sqs:*'
      Resource: '*'

custom:
  prune:
    automatic: true
    number: 30
  serverless-offline:
    noPrependStageInUrl: true
    lambdaPort: null
  logRetentionInDays: 14

plugins:
  - serverless-webpack
  - serverless-offline
  - serverless-prune-plugin

functions:
  helloWorld:
    handler: src/handler.helloWorld
    memorySize: 128
    timeout: 3
    events:
      - http:
          path: hello-world
          method: get
          cors:
            origin: '*'
            headers:
              - Content-Type
              - Content-Length
              - X-Version
            allowCredentials: true
    environment:
      STAGE: \${env:STAGE}
`;
const packageConfig = `{
  "name": "${appName}",
  "scripts": {
    "clean": "rm -rf node_modules && yarn",
    "start": "sls offline --host 0.0.0.0 --noTimeout",
    "deploy": "SLS_DEBUG=* sls deploy"
  },
  "dependencies": {
    "cross-fetch": "^2.2.2",
    "luxon": "^1.8.2",
    "serverless-simple-middleware": "^0.0.50",
    "simple-staging": "^0.0.12"
  },
  "devDependencies": {
    "@types/luxon": "^1.4.1",
    "@types/node": "^14.16.0",
    "prettier": "^1.19.1",
    "raw-loader": "^4.0.2",
    "serverless": "3.22.0",
    "serverless-offline": "^10.0.2",
    "serverless-prune-plugin": "^2.0.1",
    "serverless-webpack": "^5.9.0",
    "ts-loader": "^5.3.1",
    "typescript": "4.3.5",
    "webpack": "^4.27.1"
  },
  "prettier": {
    "printWidth": 80,
    "singleQuote": true,
    "trailingComma": "all"
  },
  "resolutions": {
    "**/graceful-fs": "4.2.8"
  }
}
`;
const tsConfig = `{
  "compilerOptions": {
    "sourceMap": true,
    "target": "es5",
    "outDir": ".build",
    "moduleResolution": "node",
    "lib": ["es2015", "esnext", "dom"],
    "preserveConstEnums": true,
    "forceConsistentCasingInFileNames": true,
    "noImplicitReturns": true,
    "noImplicitThis": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "suppressImplicitAnyIndexErrors": true,
    "noUnusedLocals": true,
    "allowSyntheticDefaultImports": true,
    "downlevelIteration": true,
    "resolveJsonModule": true
  },
  "exclude": ["node_modules/**/*", ".build/"]
}
`;
const handler = `import { handler } from './middleware';

export const helloWorld = handler(
  async ({ request, aux }): Promise<{msg: string}> => {
    const { db, tracer, logger } = aux;
    console.log('hello world!');

    return { msg: 'hello world!' };
  },
);
`;
const middleware = `import {
  AWSPluginAux,
  LoggerPluginAux,
  LogLevel,
  middleware,
  MySQLPluginAux,
  TracerPluginAux,
} from 'serverless-simple-middleware';

export type Aux = AWSPluginAux &
  TracerPluginAux &
  LoggerPluginAux &
  MySQLPluginAux;

const dbConfiguration = {
  database: 'database name',
};

export const handler = middleware.build<Aux>([
  middleware.aws({
    config: undefined,
  }),
  middleware.trace({
    route: 'es:index/event',
    queueName: 'event_queue',
    system: 'AppName',
    awsConfig: undefined,
    region: 'ap-northeast-2',
  }),
  middleware.logger({
    name: __filename,
    level: LogLevel.Stupid,
  }),
  middleware.mysql({
    config: dbConfiguration,
  }),
]);
`;
const gitIgnore = 'node_modules';

execSync(`mkdir ${appName}`);
execSync(`cd ${appName} && git init`);
fs.writeFileSync(`./${appName}/webpack.config.js`, webpackConfig, 'utf-8');
fs.writeFileSync(`./${appName}/serverless.yml`, serverlessConfig, 'utf-8');
fs.writeFileSync(`./${appName}/package.json`, packageConfig, 'utf-8');
fs.writeFileSync(`./${appName}/tsconfig.json`, tsConfig, 'utf-8');
execSync(`mkdir ${appName}/src`);
fs.writeFileSync(`./${appName}/src/handler.ts`, handler, 'utf-8');
fs.writeFileSync(`./${appName}/src/middleware.ts`, middleware, 'utf-8');
fs.writeFileSync(`./${appName}/.gitignore`, gitIgnore, 'utf-8');
execSync(`cd ${appName} && yarn`, {stdio: 'inherit'});

console.log('============================');
console.log('[Setting Complete!]');
console.log('============================');

process.exit(0);
