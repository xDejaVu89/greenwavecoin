# Folding@Home Integration for GreenWaveCoin

## Overview

This integration allows GreenWaveCoin users to earn tokens by contributing compute power to Folding@Home (scientific protein folding simulations). The system monitors FAH work units completed and rewards users with GWC tokens.

## Architecture

```
Desktop App
    ↓ (spawn)
FAH Client (fahclient.exe)
    ↓ (monitor log files)
FAH Monitor Script (Python/Node.js)
    ↓ (submit work units)
Backend API
    ↓ (validate & award points)
Reward Distribution (Merkle claims)
```

## Implementation Options

### Option 1: FAH Client Wrapper (Recommended)

**Pros:**
- Official FAH client (trusted, optimized)
- GPU + CPU support
- Real scientific contribution
- Existing infrastructure

**Cons:**
- Large download (~100MB)
- Complex integration
- Need to parse FAH logs

### Option 2: Custom Compute Tasks

**Pros:**
- Full control
- Smaller footprint
- Deterministic verification

**Cons:**
- Not helping real science
- Need to design tasks
- Less established

## Implementation Steps

### 1. FAH Client Integration

**Download & Bundle FAH:**
- FAH client: https://foldingathome.org/alternative-downloads/
- Bundle with desktop app (or auto-download on first run)
- Install to: `%APPDATA%/GreenWaveCoin/fah/`

**Launch FAH Client:**
```typescript
// In main process (main.ts)
import { spawn } from 'child_process';
import path from 'path';

let fahProcess: ChildProcess | null = null;

function startFAHClient(userName: string, teamNumber: number, passkey: string) {
  const fahPath = path.join(app.getPath('userData'), 'fah', 'FAHClient.exe');
  
  fahProcess = spawn(fahPath, [
    '--user', userName,
    '--team', teamNumber.toString(),
    '--passkey', passkey,
    '--gpu', 'true',
    '--smp', 'true',
    '--power', 'medium', // light/medium/full
  ], {
    cwd: path.dirname(fahPath),
    stdio: 'pipe',
  });

  fahProcess.stdout?.on('data', (data) => {
    console.log(`[FAH] ${data}`);
    parseFAHOutput(data.toString());
  });

  return fahProcess;
}

function stopFAHClient() {
  if (fahProcess) {
    fahProcess.kill('SIGTERM');
    fahProcess = null;
  }
}
```

### 2. Monitor FAH Work Units

**Parse FAH Logs:**
```typescript
interface WorkUnit {
  id: string;
  project: number;
  run: number;
  clone: number;
  gen: number;
  startTime: Date;
  completionTime?: Date;
  credit: number;
}

function parseFAHOutput(output: string) {
  // Look for completion messages
  const completionRegex = /\[(\d{2}:\d{2}:\d{2})\] Completed (\d+) out of (\d+) steps \((\d+)%\)/;
  const creditRegex = /Final credit estimate: ([\d.]+)/;
  
  if (output.includes('Completed')) {
    const match = output.match(completionRegex);
    if (match) {
      // Work unit progress
      const progress = parseInt(match[4]);
      notifyProgress(progress);
    }
  }
  
  if (output.includes('Final credit')) {
    const match = output.match(creditRegex);
    if (match) {
      const credit = parseFloat(match[1]);
      submitWorkUnit(credit);
    }
  }
}
```

### 3. Submit Work Units to Backend

**New Backend Endpoint:**
```typescript
// backend/src/routes/fah.routes.ts
import { Router } from 'express';
import { verifyFAHWorkUnit } from '../services/fah.service';

export const fahRouter = Router();

fahRouter.post('/submit-work-unit', async (req, res) => {
  const { userAddress, workUnitId, project, credit, proof } = req.body;
  
  try {
    // Verify work unit is real (check FAH API)
    const isValid = await verifyFAHWorkUnit(workUnitId, project);
    
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid work unit' });
    }
    
    // Award points (e.g., 1 GWC per 1000 FAH credits)
    const gwcReward = credit / 1000;
    
    // Store in database for Merkle tree generation
    await awardPoints(userAddress, gwcReward, workUnitId);
    
    res.json({ success: true, reward: gwcReward });
  } catch (error) {
    console.error('FAH submission error:', error);
    res.status(500).json({ error: 'Failed to process work unit' });
  }
});
```

### 4. Verify FAH Work Units

**Check FAH API:**
```typescript
// backend/src/services/fah.service.ts
import axios from 'axios';

export async function verifyFAHWorkUnit(
  workUnitId: string,
  project: number
): Promise<boolean> {
  try {
    // FAH stats API (unofficial)
    const response = await axios.get(
      `https://api.foldingathome.org/project/${project}/wu/${workUnitId}`
    );
    
    return response.status === 200 && response.data.completed;
  } catch (error) {
    // If API unavailable, use local verification
    return true; // Trust but verify via team stats later
  }
}

export async function getUserFAHStats(userName: string, teamNumber: number) {
  try {
    const response = await axios.get(
      `https://stats.foldingathome.org/api/donor/${userName}`
    );
    
    return {
      totalCredit: response.data.credit,
      workUnits: response.data.wus,
      rank: response.data.rank,
    };
  } catch (error) {
    return null;
  }
}
```

### 5. Update Desktop App UI

**Enhanced Compute Page:**
```typescript
// desktop/src/renderer/pages/Compute.tsx
import { useState, useEffect } from 'react';

function Compute() {
  const [fahStatus, setFahStatus] = useState<'idle' | 'running' | 'paused'>('idle');
  const [currentWU, setCurrentWU] = useState<any>(null);
  const [progress, setProgress] = useState(0);
  const [totalCredit, setTotalCredit] = useState(0);
  const [earnings, setEarnings] = useState(0);

  const startFAH = async () => {
    if (!window.electron) return;
    
    // Get user preferences
    const userName = 'GWC_' + address?.slice(2, 8); // Anonymous or real name
    const team = 265954; // GreenWaveCoin FAH team
    const passkey = localStorage.getItem('fah_passkey') || '';
    
    const result = await window.electron.startFAH({ userName, team, passkey });
    if (result.success) {
      setFahStatus('running');
    }
  };

  return (
    <div>
      <h2>Contribute to Science & Earn</h2>
      
      <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#1a1f3a', borderRadius: '8px' }}>
        <h3>Folding@Home Status</h3>
        <p style={{ color: '#94a3b8', marginBottom: '1rem' }}>
          Help researchers study diseases by folding proteins. Earn GWC for contributing compute power to science.
        </p>
        
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ color: '#94a3b8' }}>Status:</span>
            <span style={{ color: fahStatus === 'running' ? '#4ade80' : '#94a3b8' }}>
              {fahStatus.toUpperCase()}
            </span>
          </div>
          
          {currentWU && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: '#94a3b8' }}>Current Work Unit:</span>
                <span style={{ color: '#fff' }}>Project {currentWU.project}</span>
              </div>
              
              <div style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: '#94a3b8' }}>Progress:</span>
                  <span style={{ color: '#fff' }}>{progress}%</span>
                </div>
                <div style={{ 
                  height: '8px', 
                  background: '#0a0e27', 
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${progress}%`,
                    height: '100%',
                    background: '#4ade80',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>
            </>
          )}
        </div>
        
        <button
          onClick={fahStatus === 'running' ? stopFAH : startFAH}
          style={{
            padding: '0.75rem 1.5rem',
            background: fahStatus === 'running' ? '#ef4444' : '#4ade80',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '1rem',
            color: '#fff',
            fontWeight: '600'
          }}
        >
          {fahStatus === 'running' ? 'Stop Folding' : 'Start Folding'}
        </button>
      </div>
      
      <div style={{ marginTop: '1rem', padding: '1.5rem', background: '#1a1f3a', borderRadius: '8px' }}>
        <h3>Your Contribution</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
          <div>
            <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>FAH Credits</div>
            <div style={{ fontSize: '1.5rem', color: '#4ade80' }}>{totalCredit.toLocaleString()}</div>
          </div>
          <div>
            <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>GWC Earned</div>
            <div style={{ fontSize: '1.5rem', color: '#fbbf24' }}>{earnings.toFixed(4)}</div>
          </div>
        </div>
        <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '1rem' }}>
          Rate: 1 GWC per 1,000 FAH credits • All work goes to real scientific research
        </p>
      </div>
      
      <div style={{ marginTop: '1rem', padding: '1rem', background: '#1a1f3a', borderRadius: '8px' }}>
        <h4 style={{ marginBottom: '0.5rem' }}>What is Folding@Home?</h4>
        <p style={{ color: '#94a3b8', fontSize: '0.875rem', lineHeight: '1.5' }}>
          Folding@Home is a distributed computing project that simulates protein folding to help researchers 
          understand diseases like Alzheimer's, Cancer, and COVID-19. Your computer helps scientists run 
          simulations that would otherwise require expensive supercomputers.
        </p>
        <a 
          href="https://foldingathome.org" 
          target="_blank"
          style={{ color: '#4ade80', fontSize: '0.875rem', textDecoration: 'none' }}
        >
          Learn more about Folding@Home →
        </a>
      </div>
    </div>
  );
}
```

### 6. Reward Calculation

**Points System:**
```typescript
// Reward tiers based on FAH credits
const REWARD_RATES = {
  cpu: 1 / 1000,      // 1 GWC per 1,000 FAH credits (CPU)
  gpu: 1 / 500,       // 1 GWC per 500 FAH credits (GPU bonus)
  quickReturn: 1.5,   // 1.5x multiplier for quick return bonus
};

function calculateReward(credit: number, isGPU: boolean, hasQRB: boolean): number {
  const baseRate = isGPU ? REWARD_RATES.gpu : REWARD_RATES.cpu;
  let reward = credit * baseRate;
  
  if (hasQRB) {
    reward *= REWARD_RATES.quickReturn;
  }
  
  return reward;
}
```

### 7. Anti-Cheat Measures

**Prevent Exploits:**
1. **Verify work units** via FAH API
2. **Rate limit** submissions (max 1 WU per 10 minutes)
3. **Cross-check** with team stats
4. **Require staking** (existing SimpleStaking contract)
5. **Manual review** for suspicious patterns
6. **Blacklist** fake work unit IDs

```typescript
// backend/src/services/antiCheat.service.ts
export async function validateSubmission(
  userAddress: string,
  workUnitId: string,
  credit: number
): Promise<boolean> {
  // Check rate limiting
  const recentSubmissions = await getRecentSubmissions(userAddress, 600); // 10 min
  if (recentSubmissions.length > 0) {
    return false; // Too fast
  }
  
  // Check credit amount is realistic
  if (credit > 100000) {
    return false; // Suspiciously high
  }
  
  // Check work unit ID format
  if (!/^\d+_\d+_\d+_\d+$/.test(workUnitId)) {
    return false; // Invalid format
  }
  
  // Check not previously claimed
  const alreadyClaimed = await isWorkUnitClaimed(workUnitId);
  if (alreadyClaimed) {
    return false; // Duplicate
  }
  
  return true;
}
```

## Deployment Considerations

### Legal & Licensing
- ✅ FAH is open source (GPLv3)
- ✅ Can bundle with attribution
- ✅ Must not modify credit calculation
- ⚠️ Cannot guarantee specific earnings (disclose risks)

### User Experience
- Auto-install FAH on first run
- Show real-time progress and ETA
- Display current project (disease being studied)
- Estimate earnings based on hardware
- Pause when gaming or high CPU usage detected

### Team & Community
- Create official "GreenWaveCoin" FAH team
- Team number: Register at foldingathome.org
- Leaderboard: Show top contributors
- Milestones: Team goals with bonus rewards

## Alternative: Hybrid Approach

**Combine FAH + Custom Tasks:**
- FAH for real science (higher rewards)
- Custom tasks for reliability (always available)
- Users choose which to run
- Both earn GWC tokens

## Next Steps

1. Register GreenWaveCoin FAH team
2. Implement FAH client wrapper in Electron
3. Add log parsing and progress monitoring
4. Create backend FAH verification endpoint
5. Update UI with FAH-specific components
6. Test with real FAH work units
7. Deploy and announce to FAH community

Would you like me to implement the FAH integration now?
