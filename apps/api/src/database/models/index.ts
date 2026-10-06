import { InstanceMeta } from './instance-meta.model';
import { User } from './user.model';
import { LoginToken } from './login-token.model';
import { Session } from './session.model';
import { Group } from './group.model';
import { Membership } from './membership.model';
import { Edition } from './edition.model';
import { Participant } from './participant.model';
import { Wishlist } from './wishlist.model';
import { WishlistItem } from './wishlist-item.model';
import { Assignment } from './assignment.model';
import { Thread } from './thread.model';
import { ChatMessage } from './chat-message.model';
import { ThreadMessage } from './thread-message.model';
import { EmailSuppression } from './email-suppression.model';

export {
  InstanceMeta,
  User,
  LoginToken,
  Session,
  Group,
  Membership,
  Edition,
  Participant,
  Wishlist,
  WishlistItem,
  Assignment,
  Thread,
  ChatMessage,
  ThreadMessage,
  EmailSuppression,
};

/**
 * Every model registered with the Sequelize instance. Models are added here as
 * each build-order step introduces its tables; the schema itself is created by
 * migrations, not by sync().
 */
export const ALL_MODELS = [
  InstanceMeta,
  User,
  LoginToken,
  Session,
  Group,
  Membership,
  Edition,
  Participant,
  Wishlist,
  WishlistItem,
  Assignment,
  Thread,
  ChatMessage,
  ThreadMessage,
  EmailSuppression,
];
