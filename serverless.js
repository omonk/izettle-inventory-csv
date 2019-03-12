const { name: service } = require('./package.json');

module.exports = {
  service,
  plugins: ['serverless-offline'],
  provider: {
    name: 'aws',
    runtime: 'nodejs8.10',
    stage: 'prod',
    region: 'eu-west-1',
    profile: 'monk',
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
      ],
    },
  },
  resources: {
    Resources: {
      LaFauxmagerieSalesBucket: {
        Type: 'AWS::S3::Bucket',
        Properties: {
          BucketName: 'LaFauxmagerieSales',
        },
      },
      LaFauxmagerieSalesBucket: {
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
  //   Outputs: {
  //     WildRydesBucketURL: {
  //       Description: 'ExtractAndUpload Lambda url',
  //       Value: { 'Fn::GetAtt': [WildRydesBucket, WebsiteURL] },
  //     },
  //   },
};
