export const copy = {
  needConfig:
    'The rat that makes all the rules squeaks: set the Ratmas announcements channel and organizer role first.',
  notOrganizer: 'Only organizers may decree Ratmas commands.',
  dmDisabled: (userMention: string) =>
    `${userMention}, a whiskered whisper from your Ratmas Santa awaits in your DMs—please enable DMs to receive it.`,
  eventOpen: (name: string) =>
    `Ratmas event opened: ${name}. Join with /ratmas join and add your Amazon wishlist!`,
  eventLocked:
    'Ratmas signups are now locked. The rat that makes all the rules thanks you for your prompt squeaks.',
  eventMatched: 'Pairs have been matched. Stand by for Ratmas DMs.',
  eventNotified: "All Ratmas Santas have been DM'd. Happy gifting! 🎁🐀",
  signupReminder: (hours: number) =>
    `By decree of the rat that makes all the rules: Ratmas signups close in ${hours} hours.`,
  buyReminder: (hours: number) =>
    `Ratmas buy date approaches in ${hours} hours. Don\'t let the cheese get cold.`,
  openingDay: 'Happy Ratmas Opening Day! Reveal, rejoice, and nibble responsibly. 🎄🐀',
};
