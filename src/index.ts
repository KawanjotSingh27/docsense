import express from 'express'
import dotenv from 'dotenv'
import { initDB } from './db/schema'
import authRouter from './routes/auth'
import { initStorage } from './storage/index'
import documentsRouter from './routes/documents'

dotenv.config()

const app = express()
app.use(express.json())
app.use('/auth', authRouter)
app.use('/documents', documentsRouter)

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

const PORT = process.env.PORT || 3000

async function start() {
  await initDB()
  await initStorage();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
  })
}

start()