import { z } from 'zod';
import {
  DisplayName,
  ErrorBody,
  IsoDateTime,
  LanguageCode,
  Slug,
  UserId,
  Username,
} from './common.js';

export const ApiError = z.object({ error: ErrorBody });
export type ApiError = z.infer<typeof ApiError>;

export const Pagination = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type Pagination = z.infer<typeof Pagination>;

export const paginated = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), nextCursor: z.string().nullable() });

export const IdParams = z.object({ id: z.uuid() });

export const User = z.object({
  id: UserId,
  username: Username,
  displayName: DisplayName,
  avatarUrl: z.url().nullable(),
  createdAt: IsoDateTime,
});
export type User = z.infer<typeof User>;

export const UserStats = z.object({
  gamesPlayed: z.int().nonnegative(),
  gamesWon: z.int().nonnegative(),
  totalScore: z.int().nonnegative(),
  correctGuesses: z.int().nonnegative(),
});
export type UserStats = z.infer<typeof UserStats>;

export const AuthTokens = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.int().positive(),
});
export type AuthTokens = z.infer<typeof AuthTokens>;

export const AuthSession = z.object({ user: User, tokens: AuthTokens });
export type AuthSession = z.infer<typeof AuthSession>;

export const GuestSignInBody = z.object({ displayName: DisplayName });
export type GuestSignInBody = z.infer<typeof GuestSignInBody>;

export const GoogleSignInBody = z.object({ idToken: z.string().min(1) });
export type GoogleSignInBody = z.infer<typeof GoogleSignInBody>;

export const AppleSignInBody = z.object({
  identityToken: z.string().min(1),
  displayName: DisplayName.optional(),
});
export type AppleSignInBody = z.infer<typeof AppleSignInBody>;

export const RefreshBody = z.object({ refreshToken: z.string().min(1) });
export type RefreshBody = z.infer<typeof RefreshBody>;

export const Profile = z.object({ user: User, stats: UserStats });
export type Profile = z.infer<typeof Profile>;

export const PublicProfile = z.object({
  user: User.pick({ username: true, displayName: true, avatarUrl: true }),
  stats: UserStats,
});
export type PublicProfile = z.infer<typeof PublicProfile>;

export const UpdateProfileBody = z
  .object({
    username: Username,
    displayName: DisplayName,
    avatarUrl: z.url().nullable(),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: 'Nothing to update' });
export type UpdateProfileBody = z.infer<typeof UpdateProfileBody>;

export const UsernameParams = z.object({ username: Username });

export const Visibility = z.enum(['public', 'unlisted', 'private']);
export type Visibility = z.infer<typeof Visibility>;

export const Difficulty = z.int().min(1).max(3);

export const WordInput = z.object({
  text: z.string().trim().min(1).max(40),
  difficulty: Difficulty.default(2),
});
export type WordInput = z.input<typeof WordInput>;

export const Word = z.object({
  id: z.uuid(),
  text: z.string(),
  difficulty: Difficulty,
});
export type Word = z.infer<typeof Word>;

export const WordPackSummary = z.object({
  id: z.uuid(),
  slug: Slug,
  name: z.string().min(1).max(60),
  language: LanguageCode,
  visibility: Visibility,
  isOfficial: z.boolean(),
  createdBy: UserId.nullable(),
  wordCount: z.int().nonnegative(),
  updatedAt: IsoDateTime,
});
export type WordPackSummary = z.infer<typeof WordPackSummary>;

export const WordPackDetail = WordPackSummary.extend({ words: z.array(Word) });
export type WordPackDetail = z.infer<typeof WordPackDetail>;

export const ListWordPacksQuery = Pagination.extend({
  language: LanguageCode.optional(),
  mine: z.stringbool().optional(),
});
export type ListWordPacksQuery = z.infer<typeof ListWordPacksQuery>;

export const WordPackList = paginated(WordPackSummary);
export type WordPackList = z.infer<typeof WordPackList>;

export const CreateWordPackBody = z.object({
  slug: Slug,
  name: z.string().trim().min(1).max(60),
  language: LanguageCode.default('en'),
  visibility: Visibility.default('private'),
  words: z.array(WordInput).min(1).max(1000),
});
export type CreateWordPackBody = z.input<typeof CreateWordPackBody>;

export const UpdateWordPackBody = CreateWordPackBody.omit({ words: true })
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: 'Nothing to update' });
export type UpdateWordPackBody = z.input<typeof UpdateWordPackBody>;

export const AddWordsBody = z.object({ words: z.array(WordInput).min(1).max(1000) });
export type AddWordsBody = z.input<typeof AddWordsBody>;

export const HealthResponse = z.object({
  status: z.literal('ok'),
  uptimeS: z.number().nonnegative(),
});
export type HealthResponse = z.infer<typeof HealthResponse>;
