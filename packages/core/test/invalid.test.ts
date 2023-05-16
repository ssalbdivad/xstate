import { createMachine, createMockActorContext } from '../src/index';

const machine = createMachine({
  type: 'parallel',
  states: {
    A: {
      initial: 'A1',
      states: {
        A1: {},
        A2: {}
      }
    },
    B: {
      initial: 'B1',
      states: {
        B1: {},
        B2: {}
      }
    }
  }
});

describe('invalid or resolved states', () => {
  it('should resolve a String state', () => {
    const actorContext = createMockActorContext();
    expect(
      machine.transition(
        machine.resolveStateValue('A'),
        { type: 'E' },
        actorContext
      ).value
    ).toEqual({
      A: 'A1',
      B: 'B1'
    });
  });

  it('should resolve transitions from empty states', () => {
    const actorContext = createMockActorContext();
    expect(
      machine.transition(
        machine.resolveStateValue({ A: {}, B: {} }),
        { type: 'E' },
        actorContext
      ).value
    ).toEqual({
      A: 'A1',
      B: 'B1'
    });
  });

  it('should allow transitioning from valid states', () => {
    const actorContext = createMockActorContext();
    machine.transition(
      machine.resolveStateValue({ A: 'A1', B: 'B1' }),
      { type: 'E' },
      actorContext
    );
  });

  it('should reject transitioning from bad state configs', () => {
    const actorContext = createMockActorContext();
    expect(() =>
      machine.transition(
        machine.resolveStateValue({ A: 'A3', B: 'B3' }),
        { type: 'E' },
        actorContext
      )
    ).toThrow();
  });

  it('should resolve transitioning from partially valid states', () => {
    const actorContext = createMockActorContext();
    expect(
      machine.transition(
        machine.resolveStateValue({ A: 'A1', B: {} }),
        { type: 'E' },
        actorContext
      ).value
    ).toEqual({
      A: 'A1',
      B: 'B1'
    });
  });
});

describe('invalid transition', () => {
  it('should throw when attempting to create a machine with a sibling target on the root node', () => {
    expect(() => {
      createMachine({
        id: 'direction',
        initial: 'left',
        states: {
          left: {},
          right: {}
        },
        on: {
          LEFT_CLICK: 'left',
          RIGHT_CLICK: 'right'
        }
      });
    }).toThrowError(/invalid target/i);
  });
});
