import type { CircuitState } from '../types';

export const initialCircuitData: CircuitState = {
  simulationMode: 'energized',
  nodes: [
    {
      id: 'src-1',
      type: 'source',
      label: 'Main Feed 480V',
      x: 100,
      y: 300,
      status: 'energized',
      meta: { voltage: '480V', current: '200A' }
    },
    {
      id: 'cb-1',
      type: 'breaker',
      label: 'CB-1',
      x: 300,
      y: 300,
      status: 'energized',
      meta: { rating: '100A', model: 'Siemens 3VA' }
    },
    {
      id: 't-1',
      type: 'transform',
      label: 'T-1',
      x: 500,
      y: 300,
      status: 'energized',
      meta: { ratio: '480:120' }
    },
    {
      id: 'sw-1',
      type: 'switch',
      label: 'Disc-1',
      x: 700,
      y: 200,
      status: 'energized',
      meta: { type: 'Rotary' }
    },
    {
      id: 'm-1',
      type: 'motor',
      label: 'M1: Pump',
      x: 900,
      y: 200,
      status: 'energized',
      meta: { hp: '15HP', rpm: '1750' }
    },
    {
      id: 'cap-1',
      type: 'capacitor',
      label: 'C-1 Bank',
      x: 700,
      y: 400,
      status: 'energized',
      meta: { kvar: '50' }
    }
  ],
  edges: [
    { id: 'e1', source: 'src-1', target: 'cb-1', energized: true },
    { id: 'e2', source: 'cb-1', target: 't-1', energized: true },
    { id: 'e3', source: 't-1', target: 'sw-1', energized: true },
    { id: 'e4', source: 'sw-1', target: 'm-1', energized: true },
    { id: 'e5', source: 't-1', target: 'cap-1', energized: true }
  ],
  lotoSteps: [
    {
      id: 'step-1',
      order: 1,
      action: 'Open Breaker CB-1',
      componentId: 'cb-1',
      type: 'isolation',
      completed: false,
      status: 'pending'
    },
    {
      id: 'step-2',
      order: 2,
      action: 'Verify Zero Energy at T-1',
      componentId: 't-1',
      type: 'verification',
      completed: false,
      status: 'pending'
    },
    {
      id: 'step-3',
      order: 3,
      action: 'Apply Lock #492 to CB-1',
      componentId: 'cb-1',
      type: 'lockout',
      completed: false,
      status: 'pending'
    }
  ]
};
