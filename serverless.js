const { name: service } = require('./package.json');

module.exports = {
  service,
  plugins: ['serverless-offline', 'serverless-offline-scheduler'],
  custom: {
    stage: '${opt:stage, "development"}',
  },
  provider: {
    name: 'aws',
    runtime: 'nodejs8.10',
    stage: '${self:custom.stage}',
    region: 'eu-west-1',
    profile: 'monk',
    environment: {
      IZETTLE_CLIENT_ID: '${env:IZETTLE_CLIENT_ID}',
      IZETTLE_CLIENT_SECRET: '${env:IZETTLE_CLIENT_SECRET}',
      IZETTLE_EMAIL: '${env:IZETTLE_EMAIL}',
      IZETTLE_PASSWORD: '${env:IZETTLE_PASSWORD}',
      STAGE: '${self:custom.stage}',
    },
    iamRoleStatements: [
      {
        Effect: 'Allow',
        Action: ['s3:*Object'],
        Resource: ['arn:aws:s3:::lafauxmagerietransactions/*'],
      },
    ],
  },
  functions: {
    ExtractAndUpload: {
      handler: 'handlers/index.handle',
      events: [
        {
          http: {
            path: '/',
            method: 'get',
          },
        },
        {
          schedule: {
            rate: 'cron(0 23 ? * SUN *)',
            input: {
              type: 'weekly',
            },
          },
        },
        {
          schedule: {
            rate: 'cron(0 23 ? * WED,THURS,FRI,SAT,SUN *)',
            input: {
              type: 'daily',
            },
          },
        },
      ],
      environment: {
        TRANSACTIONS_BUCKET: {
          Ref: 'LaFauxmagerieSalesBucket',
        },
      },
    },
  },
  resources: {
    Resources: {
      LaFauxmagerieSalesBucket: {
        Type: 'AWS::S3::Bucket',
        Properties: {
          BucketName: 'lafauxmagerietransactions',
          AccessControl: 'AuthenticatedRead',
        },
      },
      LaFauxmagerieSalesBucketPolicy: {
        Type: 'AWS::S3::BucketPolicy',
        Properties: {
          Bucket: {
            Ref: 'LaFauxmagerieSalesBucket',
          },
          PolicyDocument: {
            Statement: [
              {
                Effect: 'Allow',
                Action: ['s3:PutObject'],
                Resource: {
                  'Fn::Join': [
                    '',
                    [
                      'arn:aws:s3:::',
                      { Ref: 'LaFauxmagerieSalesBucket' },
                      '/*',
                    ],
                  ],
                },
                Principal: '*',
              },
            ],
          },
        },
      },
    },
  },
};
