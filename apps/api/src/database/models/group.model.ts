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

export type GroupVisibility = 'private' | 'semi_public';

@Table({ tableName: 'group', timestamps: false, underscored: true })
export class Group extends Model<
  InferAttributes<Group>,
  InferCreationAttributes<Group>
> {
  @Attribute(DataTypes.UUID)
  @PrimaryKey
  @Default(sql.uuidV4.asJavaScript)
  declare id: CreationOptional<string>;

  @Attribute(DataTypes.TEXT)
  @NotNull
  declare name: string;

  // 'private' = admin approves join requests; 'semi_public' = joining is immediate.
  @Attribute(DataTypes.TEXT)
  @NotNull
  @Default('private')
  declare visibility: CreationOptional<GroupVisibility>;

  // Shareable group invite token (replaces the per-edition token for joining).
  @Attribute(DataTypes.TEXT)
  declare inviteToken: string | null;

  @Attribute(DataTypes.TEXT)
  @NotNull
  @Default('en')
  declare defaultLanguage: CreationOptional<string>;

  @Attribute(DataTypes.UUID)
  declare createdBy: string | null;

  @Attribute(DataTypes.DATE)
  @NotNull
  declare lastActivityAt: CreationOptional<Date>;

  @Attribute(DataTypes.DATE)
  declare createdAt: CreationOptional<Date>;
}
