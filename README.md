# S3からのDB登録処理

S3からイベントを受け取ったlambdaはDBにデータを登録します

## Dependency

- node(v12.18.2)
- npm(6.14.5)
- その他ライブラリは `package.json` のdependenciesを参照

## Setup

### local

`package.json`に設定があるので、同ディレクトで以下のコマンドで必要なモジュールがインストールされます
```
npm install
```

※必要なモジュールが増えたら、`npm install {module_name}` でpackage.jsonに追加されます
→ex) pg-copy-streamsのインストール `npm install pg-copy-streams`

実行
```
export PGPASS=******
node src/test.js
```
### aws

CloudFormationでlambdaを作成します
以下を実行すると以下を作成します

- S3
- lambda
- Role
- lambdaとS3の連携（Event）

```
# 必要応じて指定する
bucket_name="cmind.dev.build.artifacts"
stack_name="DevCsvLoader"
config_name="dev.properties"
# パッケージ化に必要な階層を作成
mkdir cfn/out
# yamlをパッケージ化
aws cloudformation package \
    --template-file cfn/lambda.yaml \
    --output-template-file cfn/out/lambda.yaml \
    --s3-bucket ${bucket_name} \
    --s3-prefix lambda \
    --region ap-northeast-1
# 作成（デプロイ）
aws cloudformation deploy \
    --template-file cfn/out/lambda.yaml \
    --s3-bucket ${bucket_name} \
    --s3-prefix lambda-cfn \
    --stack-name ${stack_name} \
    --parameter-overrides $(cat cfn/config/${config_name}) \
    --capabilities CAPABILITY_IAM \
    --region ap-northeast-1
```
※新規作成時はlambdaのソース（zip）をpropertiesファイルに合わせてS3に配置してください（`HandlerZipBucket`と`HandlerZipKey`を参照）

## Deploy

パラメータを設定して以下を実行してください
詳しくは`deploy.sh`を参照してください

```
bash deploy.sh ${bucket_name} ${stack_name} ${config_name}
```

