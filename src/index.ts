import app from './app'
import { initDB } from './db/schema'
import { initStorage } from './storage'
import dotenv from 'dotenv'

dotenv.config()

const PORT = process.env.PORT || 3000

async function start() {
  await initDB()
  await initStorage()
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
}

start()