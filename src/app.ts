import express from 'express'
import dotenv from 'dotenv'
import authRouter from './routes/auth'
import documentsRouter from './routes/documents'
import queryRouter from './routes/query'

dotenv.config()

const app = express()
app.use(express.json())

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.use('/auth', authRouter)
app.use('/documents', documentsRouter)
app.use('/query', queryRouter)

export default app