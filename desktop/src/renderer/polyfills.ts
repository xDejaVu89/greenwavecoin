// Buffer polyfill for ethers in browser
import { Buffer } from 'buffer';
(window as any).Buffer = Buffer;
