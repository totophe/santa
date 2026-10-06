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

export type ParticipantStatus = 'invited' | 'confirmed';

@Table({ tableName: 'participant', timestamps: false, underscored: true })
export class Participant extends Model<
  InferAttributes<Participant>,
  InferCreationAttributes<Participant>
> {
  @Attribute(DataTypes.UUID)
  @PrimaryKey
  @Default(sql.uuidV4.asJavaScript)
  declare id: CreationOptional<string>;

  @Attribute(DataTypes.UUID)
  @NotNull
  declare editionId: string;

  @Attribute(DataTypes.UUID)
  declare userId: string | null;

  @Attribute(DataTypes.TEXT)
  declare invitedEmail: string | null;

  @Attribute(DataTypes.TEXT)
  declare invitedFirstName: string | null;

  @Attribute(DataTypes.TEXT)
  @NotNull
  @Default('invited')
  declare status: CreationOptional<ParticipantStatus>;

  @Attribute(DataTypes.DATE)
  declare confirmedAt: Date | null;

  @Attribute(DataTypes.DATE)
  declare drawCheckedAt: Date | null;

  @Attribute(DataTypes.BOOLEAN)
  @NotNull
  @Default(false)
  declare drawChanged: CreationOptional<boolean>;

  @Attribute(DataTypes.TEXT)
  declare aliasKey: string | null;

  @Attribute(DataTypes.DATE)
  declare chatReadAt: Date | null;

  @Attribute(DataTypes.DATE)
  declare threadReadAsSantaAt: Date | null;

  @Attribute(DataTypes.DATE)
  declare threadReadAsRecipientAt: Date | null;

  @Attribute(DataTypes.DATE)
  declare createdAt: CreationOptional<Date>;
}
