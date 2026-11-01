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
/** 'pending' = a join request awaiting admin approval; 'active' = a real member. */
export type MemberStatus = 'active' | 'pending';

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

  @Attribute(DataTypes.UUID)
  @NotNull
  declare userId: string;

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
