import request from 'supertest';
import { Wallet, HDNodeWallet } from 'ethers';
import app from '../src/index';
import { taskService } from '../src/services/task.service';

describe('Compute Flow Integration', () => {
  let wallet: HDNodeWallet;
  let address: string;

  beforeAll(() => {
    // Create ephemeral test wallet
    wallet = Wallet.createRandom();
    address = wallet.address;
  });

  beforeEach(() => {
    // Clear in-memory state
    while (taskService.getNextTask()) { /* drain */ }
  });

  it('should create task, fetch it, and submit valid result', async () => {
    // Admin creates task
    const createResp = await request(app)
      .post('/api/tasks/create')
      .send({ payload: { work: 'test', n: 42 } })
      .expect(200);

    const taskId = createResp.body.task.id;
    const payload = createResp.body.task.payload;

    // Worker fetches task
    const fetchResp = await request(app)
      .get('/api/tasks')
      .expect(200);

    expect(fetchResp.body.task.id).toBe(taskId);

    // Worker hashes payload (use crypto sha256 for test; real worker uses blake3)
    const crypto = await import('crypto');
    const hashBytes = crypto.createHash('sha256').update(payload).digest();
    const hash = '0x' + hashBytes.toString('hex');

    // Worker signs hash
    const signature = await wallet.signMessage(hashBytes);

    // Worker submits result
    const submitResp = await request(app)
      .post('/api/results')
      .send({ id: taskId, worker: address, hash, signature })
      .expect(200);

    expect(submitResp.body.accepted).toBe(true);
    expect(submitResp.body.validSignature).toBe(true);

    // Verify result stored
    const resultsResp = await request(app)
      .get('/api/results')
      .expect(200);

    expect(resultsResp.body.results).toHaveLength(1);
    expect(resultsResp.body.results[0].id).toBe(taskId);
    expect(resultsResp.body.results[0].validSignature).toBe(true);
  });

  it('should return 204 when no tasks available', async () => {
    await request(app)
      .get('/api/tasks')
      .expect(204);
  });

  it('should reject result with invalid signature', async () => {
    // Create and fetch task
    const createResp = await request(app)
      .post('/api/tasks/create')
      .send({ payload: 'test' })
      .expect(200);

    const taskId = createResp.body.task.id;
    await request(app).get('/api/tasks').expect(200);

    // Submit with wrong signature
    const fakeWallet = Wallet.createRandom();
    const crypto2 = await import('crypto');
    const hashBytes2 = crypto2.createHash('sha256').update('test').digest();
    const hash = '0x' + hashBytes2.toString('hex');
    const wrongSig = await fakeWallet.signMessage(hashBytes2);

    const submitResp = await request(app)
      .post('/api/results')
      .send({ id: taskId, worker: address, hash, signature: wrongSig })
      .expect(200);

    expect(submitResp.body.accepted).toBe(true);
    expect(submitResp.body.validSignature).toBe(false);
  });
});
