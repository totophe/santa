import {
  Model,
  DataTypes,
  sql,
  type InferAttributes,
  type InferCreationAttributes,
  type CreationOptional,
} from '@sequelize/core';
import {
  Attribute,
  PrimaryKey,
  NotNull,
  Default,
  Table,
} from '@sequelize/core/decorators-legacy';

export type MemberRole = 'member' | 'admin';
/**
 * 'active'  = a real member.
 * 'pending' = a self-requested join awaiting admin approval.
 * 'invited' = an admin invited this email; awaiting the person to accept.
 */
export type MemberStatus = 'active' | 'pending' | 'invited';

@Table({ tableName: 'membership', timestamps: false, underscored: true })
export class Membership extends Model<
  InferAttributes<Membership>,
  InferCreationAttributes<Membership>
> {
  @Attribute(DataTypes.UUID)
  @PrimaryKey
  @Default(sql.uuidV4.asJavaScript)
  declare id: CreationOptional<string>;

  @Attribute(DataTypes.UUID)
  @NotNull
  declare groupId: string;

  // Null until an email-invite is accepted (the person may have no account yet).
  @Attribute(DataTypes.UUID)
  declare userId: string | null;

  // Set on an email-invite (status 'invited'); the admin-provided display name.
  @Attribute(DataTypes.TEXT)
  declare invitedEmail: string | null;

  @Attribute(DataTypes.TEXT)
  declare invitedFirstName: string | null;

  @Attribute(DataTypes.TEXT)
  @NotNull
  @Default('member')
  declare role: CreationOptional<MemberRole>;

  @Attribute(DataTypes.TEXT)
  @NotNull
  @Default('active')
  declare status: CreationOptional<MemberStatus>;

  @Attribute(DataTypes.DATE)
  declare createdAt: CreationOptional<Date>;
}
