import express from 'express'
import dotenv from 'dotenv'
import { initDB } from './db/schema'
import authRouter from './routes/auth'
import { initStorage } from './storage/index'
import documentsRouter from './routes/documents'
import queryRouter from './routes/query'

dotenv.config()

const app = express()
app.use(express.json())
app.use('/auth', authRouter)
app.use('/documents', documentsRouter)
app.use('/query',queryRouter);

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

//eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4NzE3NTRmNS1lODJhLTRhMDgtYjA2YS1lOTkwMjNkODUyMTAiLCJ0ZW5hbnRJZCI6ImMwNTkwZmU1LThmNzItNGVmYi1hNWNjLTE4OWNhMzg4NmViYyIsImlhdCI6MTc4MDMxNjc4MiwiZXhwIjoxNzgwOTIxNTgyfQ.KISVH001AiTYfMIyxRniP0d6nfFmLPx571CpqnPHsiE