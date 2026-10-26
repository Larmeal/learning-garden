# Rule index (Spark v4.2.0, commit 32f72996)

Generated from source by a script, not by an LLM. Paths are relative to `sql/`.
Rules are classes or objects that extend `Rule[LogicalPlan]` or `Rule[SparkPlan]`. Batches come from
`Batch("name", strategy, rules...)` lists. Rules that appear in no batch here are used elsewhere
(physical preparation rules, extensions) or by indirect lists the script cannot see.

Totals: 274 rule definitions, 65 batches.

## Optimizer.scala

### Operator Optimization before Inferring Filters  (fixedPoint, line 165)

- PushProjectionThroughUnion: catalyst/optimizer/Optimizer.scala:1005
- PushProjectionThroughLimitAndOffset: catalyst/optimizer/PushProjectionThroughLimitAndOffset.scala:27
- ReorderJoin: catalyst/optimizer/joins.scala:45
- EliminateOuterJoin: catalyst/optimizer/joins.scala:158
- PushDownPredicates: catalyst/optimizer/Optimizer.scala:2078
- PushDownLeftSemiAntiJoin: catalyst/optimizer/PushDownLeftSemiAntiJoin.scala:35
- PushLeftSemiLeftAntiThroughJoin: catalyst/optimizer/PushDownLeftSemiAntiJoin.scala:190
- OptimizeJoinCondition: catalyst/optimizer/OptimizeJoinCondition.scala:29
- LimitPushDown: catalyst/optimizer/Optimizer.scala:895
- LimitPushDownThroughWindow: catalyst/optimizer/LimitPushDownThroughWindow.scala:32
- ColumnPruning: catalyst/optimizer/Optimizer.scala:1077
- GenerateOptimization: catalyst/optimizer/Optimizer.scala:2894
- CollapseRepartition: catalyst/optimizer/Optimizer.scala:1593
- CollapseProject: catalyst/optimizer/Optimizer.scala:1232
- OptimizeWindowFunctions: catalyst/optimizer/Optimizer.scala:1638
- CollapseWindow: catalyst/optimizer/Optimizer.scala:1656
- EliminateOffsets: catalyst/optimizer/Optimizer.scala:2516
- EliminateLimits: catalyst/optimizer/Optimizer.scala:2480
- CombineUnions: catalyst/optimizer/Optimizer.scala:1845
- OptimizeRepartition: catalyst/optimizer/Optimizer.scala:1625
- EliminateWindowPartitions: catalyst/optimizer/EliminateWindowPartitions.scala:28
- TransposeWindow: catalyst/optimizer/Optimizer.scala:1692
- NullPropagation: catalyst/optimizer/expressions.scala:900
- RewriteNonCorrelatedExists: catalyst/optimizer/finishAnalysis.scala:67
- NullDownPropagation: catalyst/optimizer/expressions.scala:976
- ConstantPropagation: catalyst/optimizer/expressions.scala:135
- FoldablePropagation: catalyst/optimizer/expressions.scala:1018
- OptimizeIn: catalyst/optimizer/expressions.scala:352
- OptimizeRand: catalyst/optimizer/OptimizeRand.scala:33
- ConstantFolding: catalyst/optimizer/expressions.scala:50
- EliminateAggregateFilter: catalyst/optimizer/Optimizer.scala:604
- ReorderAssociativeOperator: catalyst/optimizer/expressions.scala:272
- LikeSimplification: catalyst/optimizer/expressions.scala:803
- BooleanSimplification: catalyst/optimizer/expressions.scala:392
- SimplifyConditionals: catalyst/optimizer/expressions.scala:628
- PushFoldableIntoBranches: catalyst/optimizer/expressions.scala:713
- SimplifyBinaryComparison: catalyst/optimizer/expressions.scala:574
- ReplaceNullWithFalseInPredicate: catalyst/optimizer/ReplaceNullWithFalseInPredicate.scala:53
- PruneFilters: catalyst/optimizer/Optimizer.scala:2041
- SimplifyCasts: catalyst/optimizer/expressions.scala:1155
- SimplifyCaseConversionExpressions: catalyst/optimizer/expressions.scala:1185
- SimplifyDateTimeConversions: catalyst/optimizer/expressions.scala:1201
- RewriteCorrelatedScalarSubquery: catalyst/optimizer/subquery.scala:698
- RewriteLateralSubquery: catalyst/optimizer/subquery.scala:1090
- EliminateSerialization: catalyst/optimizer/objects.scala:40
- RemoveRedundantAliases: catalyst/optimizer/Optimizer.scala:626
- RemoveRedundantAggregates: catalyst/optimizer/RemoveRedundantAggregates.scala:30
- UnwrapCastInBinaryComparison: catalyst/optimizer/UnwrapCastInBinaryComparison.scala:102
- RemoveNoopOperators: catalyst/optimizer/Optimizer.scala:812
- OptimizeUpdateFields: catalyst/optimizer/UpdateFields.scala:33
- SimplifyExtractValueOps: catalyst/optimizer/ComplexTypes.scala:28
- OptimizeCsvJsonExprs: catalyst/optimizer/OptimizeCsvJsonExprs.scala:39
- CombineConcats: catalyst/optimizer/expressions.scala:1244
- PushdownPredicatesAndPruneColumnsForCTEDef: catalyst/optimizer/PushdownPredicatesAndPruneColumnsForCTEDef.scala:33

### Infer Filters  (Once, line 167)

- InferFiltersFromGenerate: catalyst/optimizer/Optimizer.scala:1724
- InferFiltersFromConstraints: catalyst/optimizer/Optimizer.scala:1771

### Operator Optimization after Inferring Filters  (fixedPoint, line 170)

- PushProjectionThroughUnion: catalyst/optimizer/Optimizer.scala:1005
- PushProjectionThroughLimitAndOffset: catalyst/optimizer/PushProjectionThroughLimitAndOffset.scala:27
- ReorderJoin: catalyst/optimizer/joins.scala:45
- EliminateOuterJoin: catalyst/optimizer/joins.scala:158
- PushDownPredicates: catalyst/optimizer/Optimizer.scala:2078
- PushDownLeftSemiAntiJoin: catalyst/optimizer/PushDownLeftSemiAntiJoin.scala:35
- PushLeftSemiLeftAntiThroughJoin: catalyst/optimizer/PushDownLeftSemiAntiJoin.scala:190
- OptimizeJoinCondition: catalyst/optimizer/OptimizeJoinCondition.scala:29
- LimitPushDown: catalyst/optimizer/Optimizer.scala:895
- LimitPushDownThroughWindow: catalyst/optimizer/LimitPushDownThroughWindow.scala:32
- ColumnPruning: catalyst/optimizer/Optimizer.scala:1077
- GenerateOptimization: catalyst/optimizer/Optimizer.scala:2894
- CollapseRepartition: catalyst/optimizer/Optimizer.scala:1593
- CollapseProject: catalyst/optimizer/Optimizer.scala:1232
- OptimizeWindowFunctions: catalyst/optimizer/Optimizer.scala:1638
- CollapseWindow: catalyst/optimizer/Optimizer.scala:1656
- EliminateOffsets: catalyst/optimizer/Optimizer.scala:2516
- EliminateLimits: catalyst/optimizer/Optimizer.scala:2480
- CombineUnions: catalyst/optimizer/Optimizer.scala:1845
- OptimizeRepartition: catalyst/optimizer/Optimizer.scala:1625
- EliminateWindowPartitions: catalyst/optimizer/EliminateWindowPartitions.scala:28
- TransposeWindow: catalyst/optimizer/Optimizer.scala:1692
- NullPropagation: catalyst/optimizer/expressions.scala:900
- RewriteNonCorrelatedExists: catalyst/optimizer/finishAnalysis.scala:67
- NullDownPropagation: catalyst/optimizer/expressions.scala:976
- ConstantPropagation: catalyst/optimizer/expressions.scala:135
- FoldablePropagation: catalyst/optimizer/expressions.scala:1018
- OptimizeIn: catalyst/optimizer/expressions.scala:352
- OptimizeRand: catalyst/optimizer/OptimizeRand.scala:33
- ConstantFolding: catalyst/optimizer/expressions.scala:50
- EliminateAggregateFilter: catalyst/optimizer/Optimizer.scala:604
- ReorderAssociativeOperator: catalyst/optimizer/expressions.scala:272
- LikeSimplification: catalyst/optimizer/expressions.scala:803
- BooleanSimplification: catalyst/optimizer/expressions.scala:392
- SimplifyConditionals: catalyst/optimizer/expressions.scala:628
- PushFoldableIntoBranches: catalyst/optimizer/expressions.scala:713
- SimplifyBinaryComparison: catalyst/optimizer/expressions.scala:574
- ReplaceNullWithFalseInPredicate: catalyst/optimizer/ReplaceNullWithFalseInPredicate.scala:53
- PruneFilters: catalyst/optimizer/Optimizer.scala:2041
- SimplifyCasts: catalyst/optimizer/expressions.scala:1155
- SimplifyCaseConversionExpressions: catalyst/optimizer/expressions.scala:1185
- SimplifyDateTimeConversions: catalyst/optimizer/expressions.scala:1201
- RewriteCorrelatedScalarSubquery: catalyst/optimizer/subquery.scala:698
- RewriteLateralSubquery: catalyst/optimizer/subquery.scala:1090
- EliminateSerialization: catalyst/optimizer/objects.scala:40
- RemoveRedundantAliases: catalyst/optimizer/Optimizer.scala:626
- RemoveRedundantAggregates: catalyst/optimizer/RemoveRedundantAggregates.scala:30
- UnwrapCastInBinaryComparison: catalyst/optimizer/UnwrapCastInBinaryComparison.scala:102
- RemoveNoopOperators: catalyst/optimizer/Optimizer.scala:812
- OptimizeUpdateFields: catalyst/optimizer/UpdateFields.scala:33
- SimplifyExtractValueOps: catalyst/optimizer/ComplexTypes.scala:28
- OptimizeCsvJsonExprs: catalyst/optimizer/OptimizeCsvJsonExprs.scala:39
- CombineConcats: catalyst/optimizer/expressions.scala:1244
- PushdownPredicatesAndPruneColumnsForCTEDef: catalyst/optimizer/PushdownPredicatesAndPruneColumnsForCTEDef.scala:33

### Push extra predicate through join  (fixedPoint, line 172)

- PushExtraPredicateThroughJoin: catalyst/optimizer/PushExtraPredicateThroughJoin.scala:33
- PushDownPredicates: catalyst/optimizer/Optimizer.scala:2078

### Finish Analysis  (FixedPoint(1), line 177)

- FinishAnalysis: catalyst/optimizer/Optimizer.scala:323

### Rewrite With expression  (fixedPoint, line 180)

- RewriteWithExpression: catalyst/optimizer/RewriteWithExpression.scala:41

### Eliminate Distinct  (Once, line 184)

- EliminateDistinct: catalyst/optimizer/Optimizer.scala:572

### Inline CTE  (Once, line 190)

- InlineCTE: catalyst/optimizer/InlineCTE.scala:43

### Union  (fixedPoint, line 192)

- RemoveNoopOperators: catalyst/optimizer/Optimizer.scala:812
- CombineUnions: catalyst/optimizer/Optimizer.scala:1845
- RemoveNoopUnion: catalyst/optimizer/Optimizer.scala:842

### LocalRelation early  (fixedPoint, line 201)

- ConvertToLocalRelation: catalyst/optimizer/Optimizer.scala:2617
- UpdateAttributeNullability: catalyst/analysis/UpdateAttributeNullability.scala:34

### Pullup Correlated Expressions  (Once, line 207)

- OptimizeOneRowRelationSubquery: catalyst/optimizer/subquery.scala:1104
- PullOutNestedDataOuterRefExpressions: catalyst/optimizer/PullOutNestedDataOuterRefExpressions.scala:73
- PullupCorrelatedPredicates: catalyst/optimizer/subquery.scala:467

### Subquery  (FixedPoint(1), line 213)

- OptimizeSubqueries: catalyst/optimizer/Optimizer.scala:366
- OptimizeOneRowRelationSubquery: catalyst/optimizer/subquery.scala:1104

### Replace Operators  (fixedPoint, line 216)

- ReplaceDeduplicateWithAggregate: catalyst/optimizer/Optimizer.scala:2661
- RewriteExceptAll: catalyst/optimizer/Optimizer.scala:2763
- RewriteIntersectAll: catalyst/optimizer/Optimizer.scala:2821
- ReplaceIntersectWithSemiJoin: catalyst/optimizer/Optimizer.scala:2700
- ReplaceExceptWithFilter: catalyst/optimizer/ReplaceExceptWithFilter.scala:44
- ReplaceExceptWithAntiJoin: catalyst/optimizer/Optimizer.scala:2722
- ReplaceDistinctWithAggregate: catalyst/optimizer/Optimizer.scala:2651

### Aggregate  (fixedPoint, line 228)

- RemoveLiteralFromGroupExpressions: catalyst/optimizer/Optimizer.scala:2874
- RemoveRepetitionFromGroupExpressions: catalyst/optimizer/Optimizer.scala:2952

### Clean Up Temporary CTE Info  (Once, line 232)

- CleanUpTempCTEInfo: catalyst/optimizer/PushdownPredicatesAndPruneColumnsForCTEDef.scala:170

### Pre CBO Rules  (Once, line 235)

No rule found by the script (empty list or filled at run time, for example by user extensions).

### Early Filter and Projection Push-Down  (Once, line 239)

No rule found by the script (empty list or filled at run time, for example by user extensions).

### Update CTE Relation Stats  (Once, line 240)

- UpdateCTERelationStats: catalyst/optimizer/Optimizer.scala:472

### Join Reorder  (FixedPoint(1), line 243)

- CostBasedJoinReorder: catalyst/optimizer/CostBasedJoinReorder.scala:36

### Push Down Join Through Union  (Once, line 249)

- PushDownJoinThroughUnion: catalyst/optimizer/PushDownJoinThroughUnion.scala:51

### Eliminate Sorts  (Once, line 251)

- EliminateSorts: catalyst/optimizer/Optimizer.scala:1961
- RemoveRedundantSorts: catalyst/optimizer/RemoveRedundantSorts.scala:29, core/execution/RemoveRedundantSorts.scala:31

### Decimal Optimizations  (fixedPoint, line 254)

- DecimalAggregates: catalyst/optimizer/Optimizer.scala:2573

### Distinct Aggregate Rewrite  (Once, line 258)

- RewriteDistinctAggregates: catalyst/optimizer/RewriteDistinctAggregates.scala:199
- OptimizeExpand: catalyst/optimizer/OptimizeExpand.scala:56

### Object Expressions Optimization  (fixedPoint, line 261)

- EliminateMapObjects: catalyst/optimizer/objects.scala:115
- CombineTypedFilters: catalyst/optimizer/objects.scala:78
- ObjectSerializerPruning: catalyst/optimizer/objects.scala:126
- ReassignLambdaVariableID: catalyst/optimizer/objects.scala:251

### LocalRelation  (fixedPoint, line 266)

- ConvertToLocalRelation: catalyst/optimizer/Optimizer.scala:2617
- UpdateAttributeNullability: catalyst/analysis/UpdateAttributeNullability.scala:34

### Optimize One Row Plan  (fixedPoint, line 272)

- OptimizeOneRowPlan: catalyst/optimizer/OptimizeOneRowPlan.scala:44

### Check Cartesian Products  (Once, line 274)

- CheckCartesianProducts: catalyst/optimizer/Optimizer.scala:2542

### RewriteSubquery  (Once, line 276)

- RewritePredicateSubquery: catalyst/optimizer/subquery.scala:56
- NullPropagation: catalyst/optimizer/expressions.scala:900
- PushPredicateThroughJoin: catalyst/optimizer/Optimizer.scala:2355
- LimitPushDown: catalyst/optimizer/Optimizer.scala:895
- ColumnPruning: catalyst/optimizer/Optimizer.scala:1077
- CollapseProject: catalyst/optimizer/Optimizer.scala:1232
- RemoveRedundantAliases: catalyst/optimizer/Optimizer.scala:626
- RemoveNoopOperators: catalyst/optimizer/Optimizer.scala:812

### NormalizeFloatingNumbers  (Once, line 286)

- NormalizeFloatingNumbers: catalyst/optimizer/NormalizeFloatingNumbers.scala:72

### ReplaceUpdateFieldsExpression  (Once, line 287)

- ReplaceUpdateFieldsExpression: catalyst/optimizer/UpdateFields.scala:82

### SimplifyExtractValueOps  (FixedPoint(10), line 1483)

- SimplifyExtractValueOps: catalyst/optimizer/ComplexTypes.scala:28
- ConstantFolding: catalyst/optimizer/expressions.scala:50
- SimplifyConditionals: catalyst/optimizer/expressions.scala:628

## SparkOptimizer.scala

### Optimize Metadata Only Query  (Once, line 55)

- OptimizeMetadataOnlyQuery: core/execution/OptimizeMetadataOnlyQuery.scala:46

### PartitionPruning  (Once, line 56)

- PartitionPruning: core/execution/dynamicpruning/PartitionPruning.scala:51
- RowLevelOperationRuntimeGroupFiltering: core/execution/dynamicpruning/RowLevelOperationRuntimeGroupFiltering.scala:47
- OptimizeSubqueries: catalyst/optimizer/Optimizer.scala:366

### InjectRuntimeFilter  (FixedPoint(1), line 62)

- InjectRuntimeFilter: catalyst/optimizer/InjectRuntimeFilter.scala:37

### MergeSubplans  (Once, line 64)

- MergeSubplans: catalyst/optimizer/MergeSubplans.scala:151
- RewriteDistinctAggregates: catalyst/optimizer/RewriteDistinctAggregates.scala:199

### Pushdown Filters from PartitionPruning  (fixedPoint, line 67)

- PartitionPruning: core/execution/dynamicpruning/PartitionPruning.scala:51
- PushDownPredicates: catalyst/optimizer/Optimizer.scala:2078

### Cleanup filters that cannot be pushed down  (Once, line 69)

- CleanupDynamicPruningFilters: core/execution/dynamicpruning/CleanupDynamicPruningFilters.scala:35
- BooleanSimplification: catalyst/optimizer/expressions.scala:392
- PruneFilters: catalyst/optimizer/Optimizer.scala:2041

### Extract Python UDFs  (Once, line 75)

- ExtractPythonUDFFromJoinCondition: catalyst/optimizer/joins.scala:245
- CheckCartesianProducts: catalyst/optimizer/Optimizer.scala:2542
- ExtractPythonUDFFromAggregate: core/execution/python/ExtractPythonUDFs.scala:39
- ExtractGroupingPythonUDFFromAggregate: core/execution/python/ExtractPythonUDFs.scala:92
- ExtractPythonUDFs: core/execution/python/ExtractPythonUDFs.scala:162
- ExtractPythonUDTFs: core/execution/python/ExtractPythonUDFs.scala:384
- ColumnPruning: catalyst/optimizer/Optimizer.scala:1077
- LimitPushDown: catalyst/optimizer/Optimizer.scala:895
- PushPredicateThroughNonJoin: catalyst/optimizer/Optimizer.scala:2094
- PushProjectionThroughLimitAndOffset: catalyst/optimizer/PushProjectionThroughLimitAndOffset.scala:27
- RemoveNoopOperators: catalyst/optimizer/Optimizer.scala:812

### Infer window group limit  (Once, line 92)

- InferWindowGroupLimit: catalyst/optimizer/InferWindowGroupLimit.scala:54
- LimitPushDown: catalyst/optimizer/Optimizer.scala:895
- LimitPushDownThroughWindow: catalyst/optimizer/LimitPushDownThroughWindow.scala:32
- ConstantFolding: catalyst/optimizer/expressions.scala:50
- EliminateLimits: catalyst/optimizer/Optimizer.scala:2480

### User Provided Optimizers  (fixedPoint, line 98)

No rule found by the script (empty list or filled at run time, for example by user extensions).

### Replace CTE with Repartition  (Once, line 99)

- ReplaceCTERefWithRepartition: catalyst/optimizer/ReplaceCTERefWithRepartition.scala:37

## Analyzer.scala

### Substitution  (fixedPoint, line 513)

- OptimizeUpdateFields: catalyst/optimizer/UpdateFields.scala:33
- CTESubstitution: catalyst/analysis/CTESubstitution.scala:53
- WindowsSubstitution: catalyst/analysis/Analyzer.scala:680
- EliminateUnions: catalyst/analysis/Analyzer.scala:4414
- EliminateLazyExpression: catalyst/analysis/EliminateLazyExpression.scala:28

### Apply Limit All  (Once, line 523)

- ApplyLimitAll: catalyst/analysis/ApplyLimitAll.scala:31

### Disable Hints  (Once, line 524)

No rule found by the script (empty list or filled at run time, for example by user extensions).

### Hints  (fixedPoint, line 526)

- ResolveJoinStrategyHints: catalyst/analysis/ResolveHints.scala:54
- ResolveCoalesceHints: catalyst/analysis/ResolveHints.scala:176

### Simple Sanity Check  (Once, line 530)

- LookupFunctions: catalyst/analysis/Analyzer.scala:2242

### Keep Legacy Outputs  (Once, line 532)

- KeepLegacyOutputs: catalyst/analysis/KeepLegacyOutputs.scala:28

### Unresolve Relations  (Once, line 534)

- UnresolveRelationsInTransaction: catalyst/analysis/UnresolveRelationsInTransaction.scala:35

### Resolution  (fixedPoint, line 539)

- ResolveCatalogs: catalyst/analysis/ResolveCatalogs.scala:38
- ResolveRelations: catalyst/analysis/Analyzer.scala:1076
- ResolveChangelogTable: catalyst/analysis/ResolveChangelogTable.scala:74
- ResolvePartitionSpec: catalyst/analysis/ResolvePartitionSpec.scala:36
- ResolveFieldNameAndPosition: catalyst/analysis/Analyzer.scala:4079
- AddMetadataColumns: catalyst/analysis/Analyzer.scala:990
- DeduplicateRelations: catalyst/analysis/DeduplicateRelations.scala:29
- ResolveCollationName: catalyst/analysis/ResolveCollationName.scala:30
- ResolveSchemaEvolution: catalyst/analysis/ResolveSchemaEvolution.scala:44
- ValidateEventTimeWatermarkColumn: catalyst/analysis/Analyzer.scala:4480
- ResolveReferences: catalyst/analysis/Analyzer.scala:1530
- ResolveLateralColumnAliasReference: catalyst/analysis/ResolveLateralColumnAliasReference.scala:116
- ResolveExpressionsWithNamePlaceholders: catalyst/analysis/Analyzer.scala:4523
- ResolveDeserializer: catalyst/analysis/Analyzer.scala:3944
- ResolveNewInstance: catalyst/analysis/Analyzer.scala:4041
- ResolveUpCast: catalyst/analysis/Analyzer.scala:4061
- ResolveGroupingAnalytics: catalyst/analysis/Analyzer.scala:756
- ResolvePivot: catalyst/analysis/Analyzer.scala:906
- ResolveUnpivot: catalyst/analysis/Analyzer.scala:945
- ResolveOrdinalInOrderByAndGroupBy: catalyst/analysis/Analyzer.scala:2148
- ExtractGenerator: catalyst/analysis/Analyzer.scala:3220
- ResolveGenerate: catalyst/analysis/Analyzer.scala:3398
- ResolveFunctions: catalyst/analysis/Analyzer.scala:2317
- ResolveProcedures: catalyst/analysis/Analyzer.scala:2485
- BindProcedures: catalyst/analysis/Analyzer.scala:2496
- ResolveTableSpec: catalyst/analysis/ResolveTableSpec.scala:37
- ResolveSQLFunctions: catalyst/analysis/Analyzer.scala:2669
- ResolveSQLTableFunctions: catalyst/analysis/Analyzer.scala:2937
- ResolveAliases: catalyst/analysis/Analyzer.scala:702
- ResolveSubquery: catalyst/analysis/Analyzer.scala:2536
- ResolveSubqueryColumnAliases: catalyst/analysis/Analyzer.scala:2631
- ApplyDefaultCollation: catalyst/analysis/ApplyDefaultCollation.scala:39
- ResolveWindowOrder: catalyst/analysis/Analyzer.scala:3828
- ResolveWindowFrame: catalyst/analysis/Analyzer.scala:3818
- ResolveNaturalAndUsingJoin: catalyst/analysis/Analyzer.scala:3839
- ResolveOutputRelation: catalyst/analysis/Analyzer.scala:3870
- ResolveTableConstraints: catalyst/analysis/ResolveTableConstraints.scala:30
- ResolveSetVariable: catalyst/analysis/ResolveSetVariable.scala:34
- ResolveFetchCursor: catalyst/analysis/ResolveFetchCursor.scala:33
- ResolveCursors: catalyst/analysis/ResolveCursors.scala:38
- ExtractWindowExpressions: catalyst/analysis/Analyzer.scala:3449
- GlobalAggregates: catalyst/analysis/Analyzer.scala:3029
- ResolveAggregateFunctions: catalyst/analysis/Analyzer.scala:3062
- ResolveQualify: catalyst/analysis/Analyzer.scala:4246
- TimeWindowing: catalyst/analysis/ResolveTimeWindows.scala:35
- SessionWindowing: catalyst/analysis/ResolveTimeWindows.scala:180
- ResolveWindowTime: catalyst/analysis/ResolveTimeWindows.scala:296
- ResolveInlineTables: catalyst/analysis/ResolveInlineTables.scala:30
- ResolveLambdaVariables: catalyst/analysis/higherOrderFunctions.scala:37
- ResolveTimeZone: catalyst/analysis/timeZoneAnalysis.scala:30
- ResolveRandomSeed: catalyst/analysis/Analyzer.scala:3714
- ResolveBinaryArithmetic: catalyst/analysis/Analyzer.scala:669
- ResolveIdentifierClause: catalyst/analysis/ResolveIdentifierClause.scala:33
- ResolveUnion: catalyst/analysis/ResolveUnion.scala:33
- FlattenSequentialStreamingUnion: catalyst/analysis/SequentialUnionAnalysis.scala:33
- ValidateSequentialStreamingUnion: catalyst/analysis/SequentialUnionAnalysis.scala:52
- ResolveRowLevelCommandAssignments: catalyst/analysis/ResolveRowLevelCommandAssignments.scala:38
- MoveParameterizedQueriesDown: catalyst/analysis/parameters.scala:143
- BindParameters: catalyst/analysis/parameters.scala:175
- ResolveWithCTE: catalyst/analysis/ResolveWithCTE.scala:32
- ExtractDistributedSequenceID: catalyst/analysis/ExtractDistributedSequenceID.scala:32
- ResolveUpdateEventTimeWatermarkColumn: catalyst/analysis/ResolveUpdateEventTimeWatermarkColumn.scala:33
- NameStreamingSources: catalyst/analysis/NameStreamingSources.scala:47

### Remove TempResolvedColumn  (Once, line 613)

- RemoveTempResolvedColumn: catalyst/analysis/Analyzer.scala:4629

### Post-Hoc Resolution  (Once, line 614)

- ResolveCommandsWithIfExists: catalyst/analysis/ResolveCommandsWithIfExists.scala:29

### Remove Unresolved Hints  (Once, line 617)

- RemoveAllHints: catalyst/analysis/ResolveHints.scala:296

### Nondeterministic  (Once, line 619)

- PullOutNondeterministic: catalyst/analysis/PullOutNondeterministic.scala:32

### ScalaUDF Null Handling  (fixedPoint, line 621)

- HandleNullInputsForUDF: catalyst/analysis/Analyzer.scala:3734
- UpdateAttributeNullability: catalyst/analysis/UpdateAttributeNullability.scala:34

### UDF  (Once, line 629)

- ResolveEncodersInUDF: catalyst/analysis/Analyzer.scala:3783

### Subquery  (Once, line 631)

- UpdateOuterReferences: catalyst/analysis/Analyzer.scala:4579

### Cleanup  (fixedPoint, line 633)

- CleanupAliases: catalyst/analysis/Analyzer.scala:4428

### HandleSpecialCommand  (Once, line 635)

- HandleSpecialCommand: catalyst/analysis/Analyzer.scala:4216

### Remove watermark for batch query  (Once, line 637)

- EliminateEventTimeWatermark: catalyst/analysis/Analyzer.scala:4511

### ResolveUnresolvedHaving  (Once, line 639)

- ResolveUnresolvedHaving: catalyst/analysis/Analyzer.scala:4647

## AQEOptimizer.scala

### Propagate Empty Relations  (fixedPoint, line 40)

- ConvertToLocalRelation: catalyst/optimizer/Optimizer.scala:2617
- UpdateAttributeNullability: catalyst/analysis/UpdateAttributeNullability.scala:34

### Dynamic Join Selection  (Once, line 44)

- DynamicJoinSelection: core/execution/adaptive/DynamicJoinSelection.scala:38

### Eliminate Limits  (fixedPoint, line 45)

- EliminateLimits: catalyst/optimizer/Optimizer.scala:2480

### Optimize One Row Plan  (fixedPoint, line 46)

- OptimizeOneRowPlan: catalyst/optimizer/OptimizeOneRowPlan.scala:44

### User Provided Runtime Optimizers  (fixedPoint, line 47)

No rule found by the script (empty list or filled at run time, for example by user extensions).

## Rules not referenced in any parsed batch (78)

### catalyst/analysis

- EliminateSubqueryAliases (LogicalPlan): Analyzer.scala:4401
- ResolveEventTimeWatermark (LogicalPlan): ResolveEventTimeWatermark.scala:29
- ResolveInsertionBase (LogicalPlan): ResolveInsertionBase.scala:27
- RewriteCollationJoin (LogicalPlan): RewriteCollationJoin.scala:35
- RewriteRowLevelCommand (LogicalPlan): RewriteRowLevelCommand.scala:39
- TypeCoercionRule (LogicalPlan): TypeCoercion.scala:365
- ProcedureArgumentCoercion (LogicalPlan): TypeCoercionBase.scala:81
- DefaultValueExpressionCoercion (LogicalPlan): TypeCoercionBase.scala:96
- UnpivotCoercion (LogicalPlan): TypeCoercionBase.scala:156
- WidenSetOperationTypes (LogicalPlan): TypeCoercionBase.scala:190
- EliminateView (LogicalPlan): view.scala:33

### catalyst/analysis/resolver

- PruneMetadataColumns (LogicalPlan): PruneMetadataColumns.scala:43

### catalyst/expressions/codegen

- ExpressionCanonicalizer (Expression): package.scala:32
- CleanExpressions (Expression): package.scala:36

### catalyst/expressions

- EliminatePipeOperators (LogicalPlan): pipeOperators.scala:57

### catalyst/normalizer

- NormalizeCTEIds (LogicalPlan): NormalizeCTEIds.scala:28

### catalyst/optimizer

- EliminateResolvedHint (LogicalPlan): EliminateResolvedHint.scala:30
- EliminateSQLFunctionNode (LogicalPlan): EliminateSQLFunctionNode.scala:30
- InsertMapSortInGroupingExpressions (LogicalPlan): InsertMapSortExpression.scala:38
- InsertMapSortInRepartitionExpressions (LogicalPlan): InsertMapSortExpression.scala:90
- CombineFilters (LogicalPlan): Optimizer.scala:1925
- PropagateEmptyRelationBase (LogicalPlan): PropagateEmptyRelation.scala:47
- PullOutGroupingExpressions (LogicalPlan): PullOutGroupingExpressions.scala:48
- RewriteAsOfJoin (LogicalPlan): RewriteAsOfJoin.scala:50
- RewriteNearestByJoin (LogicalPlan): RewriteNearestByJoin.scala:71
- ReplaceExpressions (LogicalPlan): finishAnalysis.scala:49
- EvalInlineTables (LogicalPlan): finishAnalysis.scala:84
- ComputeCurrentTime (LogicalPlan): finishAnalysis.scala:112
- ReplaceCurrentLike (LogicalPlan): finishAnalysis.scala:154
- SpecialDatetimeValues (LogicalPlan): finishAnalysis.scala:179
- ReplaceTranspose (LogicalPlan): finishAnalysis.scala:196

### sql/core/src/main/scala/org/apache/spark/sql/catalyst/analysis

- EvalSubqueriesForTimeTravel (LogicalPlan): EvalSubqueriesForTimeTravel.scala:26
- InvokeProcedures (LogicalPlan): InvokeProcedures.scala:34
- ReplaceCharWithVarchar (LogicalPlan): ReplaceCharWithVarchar.scala:28
- ResolveDataSource (LogicalPlan): ResolveDataSource.scala:44
- ResolveExecuteImmediate (LogicalPlan): ResolveExecuteImmediate.scala:39
- ResolveMetricView (LogicalPlan): ResolveMetricView.scala:165
- ResolveSessionCatalog (LogicalPlan): ResolveSessionCatalog.scala:49
- ResolveSetCatalogCommand (LogicalPlan): ResolveSetCatalogCommand.scala:30
- ResolveTranspose (LogicalPlan): ResolveTranspose.scala:50

### core/execution

- ApplyColumnarRulesAndInsertTransitions (SparkPlan): Columnar.scala:502
- InsertSortForLimitAndOffset (SparkPlan): InsertSortForLimitAndOffset.scala:38
- RemoveRedundantProjects (SparkPlan): RemoveRedundantProjects.scala:39
- RemoveRedundantWindowGroupLimits (SparkPlan): RemoveRedundantWindowGroupLimits.scala:27
- ReplaceHashWithSortAgg (SparkPlan): ReplaceHashWithSortAgg.scala:55
- CollapseCodegenStages (SparkPlan): WholeStageCodegenExec.scala:914
- PlanSubqueries (SparkPlan): subquery.scala:181

### core/execution/adaptive

- AQEShuffleReadRule (SparkPlan): AQEShuffleReadRule.scala:28
- AdjustShuffleExchangePosition (SparkPlan): AdjustShuffleExchangePosition.scala:28
- InsertAdaptiveSparkPlan (SparkPlan): InsertAdaptiveSparkPlan.scala:44
- OptimizeSkewedJoin (SparkPlan): OptimizeSkewedJoin.scala:57
- PlanAdaptiveDynamicPruningFilters (SparkPlan): PlanAdaptiveDynamicPruningFilters.scala:33
- PlanAdaptiveSubqueries (SparkPlan): PlanAdaptiveSubqueries.scala:27
- ReuseAdaptiveSubquery (SparkPlan): ReuseAdaptiveSubquery.scala:26
- ValidateSparkPlan (SparkPlan): ValidateSparkPlan.scala:30

### core/execution/aggregate

- ResolveEncodersInScalaAgg (LogicalPlan): udaf.scala:575

### core/execution/analysis

- DetectAmbiguousSelfJoin (LogicalPlan): DetectAmbiguousSelfJoin.scala:46

### core/execution/bucketing

- CoalesceBucketsInJoin (SparkPlan): CoalesceBucketsInJoin.scala:40
- DisableUnnecessaryBucketedScan (SparkPlan): DisableUnnecessaryBucketedScan.scala:77

### core/execution/datasources

- ApplyCharTypePadding (LogicalPlan): ApplyCharTypePadding.scala:37
- DataSourceAnalysis (LogicalPlan): DataSourceStrategy.scala:74
- FindDataSourceTable (LogicalPlan): DataSourceStrategy.scala:253
- FallBackFileSourceV2 (LogicalPlan): FallBackFileSourceV2.scala:35
- PruneFileSourcePartitions (LogicalPlan): PruneFileSourcePartitions.scala:35
- PushVariantIntoScan (LogicalPlan): PushVariantIntoScan.scala:274
- SchemaPruning (LogicalPlan): SchemaPruning.scala:38
- V1Writes (LogicalPlan): V1Writes.scala:68
- ResolveSQLOnFile (LogicalPlan): rules.scala:51
- PreprocessTableCreation (LogicalPlan): rules.scala:138
- QualifyLocationWithWarehouse (LogicalPlan): rules.scala:718

### core/execution/datasources/v2

- GroupBasedRowLevelOperationScanPlanning (LogicalPlan): GroupBasedRowLevelOperationScanPlanning.scala:39
- OptimizeMetadataOnlyDeleteFromTable (LogicalPlan): OptimizeMetadataOnlyDeleteFromTable.scala:38
- V2ScanPartitioningAndOrdering (LogicalPlan): V2ScanPartitioningAndOrdering.scala:34
- V2ScanRelationPushDown (LogicalPlan): V2ScanRelationPushDown.scala:45
- V2Writes (LogicalPlan): V2Writes.scala:42

### core/execution/dynamicpruning

- PlanDynamicPruningFilters (SparkPlan): PlanDynamicPruningFilters.scala:37

### core/execution/exchange

- EnsureRequirements (SparkPlan): EnsureRequirements.scala:51

### core/execution/streaming/runtime

- ResolveWriteToStream (LogicalPlan): ResolveWriteToStream.scala:41

