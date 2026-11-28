import { STREAK_REWARDS, useDailyLogin } from '../dailyLogin';
import { useEconomy } from '../economy';

const reward = STREAK_REWARDS[0];

describe('dailyLogin.claimReward', () => {
  const originalEarnStardust = useEconomy.getState().earnStardust;

  beforeEach(() => {
    useEconomy.setState({ earnStardust: originalEarnStardust });
    useDailyLogin.setState({
      streak: reward.day,
      lastLoginDate: '',
      hasClaimedToday: false,
      modalVisible: true,
      currentReward: reward,
    });
  });

  afterEach(() => {
    useEconomy.setState({ earnStardust: originalEarnStardust });
  });

  it('grants the daily reward and dismisses the modal', () => {
    const earnStardust = jest.fn();
    useEconomy.setState({ earnStardust });

    useDailyLogin.getState().claimReward();

    expect(earnStardust).toHaveBeenCalledWith(reward.stardust);
    expect(useDailyLogin.getState().modalVisible).toBe(false);
    expect(useDailyLogin.getState().hasClaimedToday).toBe(true);
  });

  it('dismisses the modal when the reward was already claimed', () => {
    useDailyLogin.setState({ hasClaimedToday: true });
    const earnStardust = jest.fn();
    useEconomy.setState({ earnStardust });

    useDailyLogin.getState().claimReward();

    expect(earnStardust).not.toHaveBeenCalled();
    expect(useDailyLogin.getState().modalVisible).toBe(false);
  });

  it('dismisses the modal when granting the reward throws', () => {
    useEconomy.setState({
      earnStardust: () => {
        throw new Error('storage unavailable');
      },
    });

    expect(() => useDailyLogin.getState().claimReward()).not.toThrow();

    const state = useDailyLogin.getState();
    expect(state.modalVisible).toBe(false);
    // Not marked claimed, so the reward can be retried on the next launch.
    expect(state.hasClaimedToday).toBe(false);
  });
});
