/**
 * Public API of the `session` entity — who is currently logged in.
 *
 * This is an entity, not part of `features/auth`, because *reading* the current
 * user and *logging in* are different concerns with different consumers. Half
 * the app needs the former (`Header`, `MessageCardWithActions`, the optimistic
 * create); only the login screen needs the latter. While `useSession` lived in
 * `features/auth`, `features/message-compose` had to reach sideways into
 * another slice on its own layer — which FSD forbids for the same reason it
 * forbids reaching upwards: it makes the two slices impossible to move or
 * delete independently.
 *
 * `features/auth` keeps what is genuinely an action: the login form, the
 * login/logout server actions, and `useLogout`.
 */

export { SessionProvider, useSession, type CurrentUser } from './model/SessionProvider';
