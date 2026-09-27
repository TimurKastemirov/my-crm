/** Дефолтная воронка + этапы, создаётся при регистрации организации. */
export const DEFAULT_PIPELINE = {
  name: 'Основная воронка',
  stages: [
    { name: 'Новая', probability: 10, isWon: false, isLost: false },
    { name: 'Квалификация', probability: 25, isWon: false, isLost: false },
    { name: 'Предложение', probability: 50, isWon: false, isLost: false },
    { name: 'Переговоры', probability: 75, isWon: false, isLost: false },
    { name: 'Выиграна', probability: 100, isWon: true, isLost: false },
    { name: 'Проиграна', probability: 0, isWon: false, isLost: true },
  ],
} as const;
