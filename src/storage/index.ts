import * as Minio from 'minio'
import dotenv from 'dotenv'
dotenv.config()

export const minioClient = new Minio.Client({
  endPoint: 'localhost',
  port: 9000,
  useSSL: false,
  accessKey: process.env.MINIO_USER!,
  secretKey: process.env.MINIO_PASSWORD!,
})

export const BUCKET_NAME = 'docsense'

export async function initStorage() {
  const exists = await minioClient.bucketExists(BUCKET_NAME)
  if (!exists) {
    await minioClient.makeBucket(BUCKET_NAME)
    console.log('Storage bucket created')
  }
}