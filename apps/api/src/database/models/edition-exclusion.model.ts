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

/**
 * A symmetric "these two must not draw each other" rule for one edition (e.g. a
 * couple). Stored once per unordered pair with participant_a_id < participant_b_id;
 * the draw forbids both directions. Cascades when the edition or a participant goes.
 */
@Table({ tableName: 'edition_exclusion', timestamps: false, underscored: true })
export class EditionExclusion extends Model<
  InferAttributes<EditionExclusion>,
  InferCreationAttributes<EditionExclusion>
> {
  @Attribute(DataTypes.UUID)
  @PrimaryKey
  @Default(sql.uuidV4.asJavaScript)
  declare id: CreationOptional<string>;

  @Attribute(DataTypes.UUID)
  @NotNull
  declare editionId: string;

  @Attribute(DataTypes.UUID)
  @NotNull
  declare participantAId: string;

  @Attribute(DataTypes.UUID)
  @NotNull
  declare participantBId: string;
}
