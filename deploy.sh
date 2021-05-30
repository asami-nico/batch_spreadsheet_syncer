# ソースファイルをまとめる
today=$(date +%Y%M%d)
npm install
zip -r csv_loader_${today}.zip src node_modules
aws s3 cp csv_loader_${today}.zip s3://${bucket_name}/lambda-zip/

# 設定ファイルを最新のソースファイルのzipに更新する
config_name_mod=mod_${config_name}
sed "s/HandlerZipKey=.*/HandlerZipKey=lambda-zip\/csv_loader_${today}.zip/" cfn/config/${config_name} > cfn/config/${config_name_mod}

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
    --parameter-overrides $(cat cfn/config/${config_name_mod}) \
    --capabilities CAPABILITY_IAM \
    --region ap-northeast-1

rm -rf csv_loader_${today}.zip cfn/config/${config_name_mod}
