import request from 'supertest'
import app from '../app';

describe('Auth', () => {
  it('registers a new user and returns a token', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'test@test.com', password: 'password123', tenantName: 'Test Corp' })

    expect(res.status).toBe(201)
    expect(res.body.token).toBeDefined()
    expect(res.body.tenantId).toBeDefined()
  })

  it('rejects duplicate email', async () => {
    await request(app)
      .post('/auth/register')
      .send({ email: 'dupe@test.com', password: 'password123', tenantName: 'Corp A' })

    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'dupe@test.com', password: 'password123', tenantName: 'Corp B' })

    expect(res.status).toBe(409)
  })

  it('logs in with correct credentials', async () => {
    await request(app)
      .post('/auth/register')
      .send({ email: 'login@test.com', password: 'password123', tenantName: 'Login Corp' })

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'login@test.com', password: 'password123' })

    expect(res.status).toBe(200)
    expect(res.body.token).toBeDefined()
  })

  it('rejects wrong password', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'login@test.com', password: 'wrongpassword' })

    expect(res.status).toBe(401)
  })
})