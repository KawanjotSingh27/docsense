import request from 'supertest'
import path from 'path'
import app from '../app';

async function registerAndLogin(email: string, tenantName: string) {
  await request(app)
    .post('/auth/register')
    .send({ email, password: 'password123', tenantName })

  const res = await request(app)
    .post('/auth/login')
    .send({ email, password: 'password123' })

  return res.body.token
}

describe('Documents', () => {
  it('rejects upload without auth', async () => {
    const res = await request(app)
      .post('/documents/upload')
      .attach('file', path.join(__dirname, 'fixtures/test.pdf'))

    expect(res.status).toBe(401)
  })

  it('uploads a document and returns documentId', async () => {
    const token = await registerAndLogin('upload@test.com', 'Upload Corp')

    const res = await request(app)
      .post('/documents/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', path.join(__dirname, 'fixtures/test.pdf'))

    expect(res.status).toBe(201)
    expect(res.body.documentId).toBeDefined()
    expect(res.body.status).toBe('pending')
  })

  it('lists only documents belonging to tenant', async () => {
    const tokenA = await registerAndLogin('tenantA@test.com', 'Tenant A')
    const tokenB = await registerAndLogin('tenantB@test.com', 'Tenant B')

    await request(app)
      .post('/documents/upload')
      .set('Authorization', `Bearer ${tokenA}`)
      .attach('file', path.join(__dirname, 'fixtures/test.pdf'))

    const res = await request(app)
      .get('/documents')
      .set('Authorization', `Bearer ${tokenB}`)

    expect(res.body.length).toBe(0)
  })
})

describe('Tenant isolation', () => {
  it('cannot access another tenants document status', async () => {
    const tokenA = await registerAndLogin('isoA@test.com', 'Iso A')
    const tokenB = await registerAndLogin('isoB@test.com', 'Iso B')

    const uploadRes = await request(app)
      .post('/documents/upload')
      .set('Authorization', `Bearer ${tokenA}`)
      .attach('file', path.join(__dirname, 'fixtures/test.pdf'))

    const documentId = uploadRes.body.documentId

    const res = await request(app)
      .get(`/documents/${documentId}/status`)
      .set('Authorization', `Bearer ${tokenB}`)

    expect(res.status).toBe(404)
  })
})