const fs = require('fs');
const fspromises = require('fs').promises;
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const { Client } = require("pg");
const copyFrom = require("pg-copy-streams").from;

const downloadFromS3 = async (bucket, key, location) => {
    const { Body } = await s3.getObject({
        Bucket: bucket,
        Key: key
    }).promise();
    await fspromises.writeFile(location, Body);
    return location;
};

// 受け取ったkeyからstaffかcandidateかを判定し、downloadパスを指定。
const getDownloadPath =  (key) => {
    return (key.includes('staff') ? '/tmp/staff.csv' : '/tmp/candidates.csv');
};

const queryDb = async (client, query) => {
    await client.query(query);
    return true;
};
const copyDb = async (client, query, file) => {
    const stream = client.query(copyFrom(query));
    const fileStream = fs.createReadStream(file);
    fileStream.pipe(stream);
    return true;
};

exports.handler = async (event) => {
    //postgresのconnection作成
    const pgClient = new Client({
        host: process.env.PGHOST ||'devpostgres.cwszezhovnef.ap-northeast-1.rds.amazonaws.com',
        port: process.env.PGPORT ||'5432',
        user: process.env.PGUSER ||'dev',
        password: process.env.PGPASS,
        database: (event.client || process.env.PGDATABASEE ||'devdb'),
    });

    //DB接続
    await pgClient.connect();

    // eventから対象のbucketとkey（ファイルのパス）を取得する
    // ※同時に複数eventを受け取った場合を考慮し、ループで処理
    for(var i = 0; i < event.Records.length; i++){
        let bucket = event.Records[i].s3.bucket.name;
        let key = event.Records[i].s3.object.key;

        //S3からファイルをダウンロード
        let downloadPath = await downloadFromS3(bucket, key, getDownloadPath(key));

        if (downloadPath.includes('staff')) {
            await queryDb(pgClient, `TRUNCATE TABLE staff_temp RESTART IDENTITY`);
            await copyDb(pgClient,  `COPY staff_temp (name, employee_id, phone_number, email, role_number)
                                    FROM STDIN WITH csv encoding 'UTF8' DELIMITER ',' NULL AS ''`,
                                    '/tmp/staff.csv');
            let res1 = await queryDb(pgClient, `INSERT INTO staff
                                     SELECT * FROM staff_temp
                                     ON CONFLICT(employee_id)
                                     DO UPDATE SET
                                     name = excluded.name,
                                     phone_number = excluded.phone_number,
                                     email = excluded.email,
                                     role_number = excluded.role_number,
                                     retirement = excluded.retirement,
                                     created_at = excluded.created_at`);
            console.log("staff実行結果：" + res1);
        }else{
            await queryDb(pgClient, `TRUNCATE TABLE candidates_temp RESTART IDENTITY`);
            await copyDb(pgClient,  `COPY candidates_temp (employment, form, employee_id, name, name_kana, age, nearest_station, leader, start_date, end_date,
                                    skillsheet_dispatch, skillsheet_semises, skillsheet_ses, ng_jobs, phone_number, email, development_experience,
                                    quality_experience, infrastructure_experience, operation_experience, desired_unit_price, interview_practice_status, candidate_hash)
                                    FROM STDIN WITH csv encoding 'UTF8' DELIMITER ',' NULL AS ''`,
                                    '/tmp/candidates.csv');
            let res2 = await queryDb(pgClient, `INSERT INTO candidates
                                     SELECT * FROM candidates_temp
                                     ON CONFLICT(candidate_hash)
                                     DO UPDATE SET
                                     employment = excluded.employment,
                                     form = excluded.form,
                                     employee_id = excluded.employee_id,
                                      name = excluded.name,
                                     name_kana = excluded.name_kana,
                                     age = excluded.age,
                                     nearest_station = excluded.nearest_station,
                                     leader = excluded.leader,
                                     interview_practice_status = excluded.interview_practice_status,
                                     start_date= excluded.start_date,
                                     end_date= excluded.end_date,
                                     skillsheet_dispatch = excluded.skillsheet_dispatch,
                                     skillsheet_semises = excluded.skillsheet_semises,
                                     skillsheet_ses = excluded.skillsheet_ses,
                                     ng_jobs = excluded.ng_jobs,
                                     phone_number = excluded.phone_number,
                                     email = excluded.email,
                                     development_experience = excluded.development_experience,
                                     quality_experience = excluded.quality_experience,
                                     infrastructure_experience = excluded.infrastructure_experience,
                                     operation_experience = excluded.operation_experience,
                                     desired_unit_price = excluded.desired_unit_price,
                                     updated_at = excluded.updated_at`);
            console.log("candidates実行結果：" + res2);
        }
    }
    //DB接続切断
    await pgClient.end();
};