"""Chapter 12: MLlib (the DataFrame-based pyspark.ml API).

Runs in WSL on Windows because saving a model writes files through Hadoop. From the code folder:

    uv run python exercises/12_mllib.py
"""

import os
import random
import sys
import tempfile

sys.path.insert(0, os.path.dirname(__file__))

from common import explain, get_spark, relaunch_in_wsl_if_windows  # noqa: E402

relaunch_in_wsl_if_windows(__file__)

from pyspark.ml import Pipeline, PipelineModel  # noqa: E402
from pyspark.ml.classification import LogisticRegression, LogisticRegressionModel  # noqa: E402
from pyspark.ml.evaluation import BinaryClassificationEvaluator  # noqa: E402
from pyspark.ml.feature import OneHotEncoder, OneHotEncoderModel, StringIndexer, StringIndexerModel, VectorAssembler  # noqa: E402
from pyspark.ml.tuning import CrossValidator, ParamGridBuilder  # noqa: E402


def make_data(spark):
    random.seed(1)
    rows = []
    for _ in range(2000):
        x1, x2 = random.gauss(0, 1), random.gauss(0, 1)
        c = random.choice(["a", "b", "c"])
        y = 1.0 if (1.5 * x1 - x2 + (0.8 if c == "a" else 0) + random.gauss(0, 0.5)) > 0 else 0.0
        rows.append((x1, x2, c, y))
    return spark.createDataFrame(rows, "x1 double, x2 double, c string, label double").coalesce(4).cache()


def main():
    spark = get_spark("ch12")
    spark.sparkContext.setLogLevel("ERROR")
    spark.conf.set("spark.sql.shuffle.partitions", "4")
    sc = spark.sparkContext

    def jobs(tag):
        return len(sc.statusTracker().getJobIdsForGroup(tag))

    df = make_data(spark)
    df.count()
    train, test = df.randomSplit([0.8, 0.2], seed=7)

    idx = StringIndexer(inputCol="c", outputCol="c_idx")
    ohe = OneHotEncoder(inputCols=["c_idx"], outputCols=["c_vec"])
    va = VectorAssembler(inputCols=["x1", "x2", "c_vec"], outputCol="features")
    lr = LogisticRegression(maxIter=20, regParam=0.01)
    pipe = Pipeline(stages=[idx, ohe, va, lr])

    # Param: typed settings with defaults, explained and read through the object.
    assert LogisticRegression().getOrDefault("maxIter") == 100
    assert LogisticRegression().getOrDefault("regParam") == 0.0
    assert LogisticRegression().getOrDefault("threshold") == 0.5
    assert lr.getOrDefault("maxIter") == 20 and lr.isSet("maxIter") and not lr.isSet("tol")
    assert "default: 0.0, current: 0.01" in lr.explainParam("regParam")
    copied = lr.copy({lr.regParam: 0.5})
    assert copied.getOrDefault("regParam") == 0.5 and lr.getOrDefault("regParam") == 0.01, "copy does not touch the original"

    # transform is lazy, fit is an action.
    va_only = VectorAssembler(inputCols=["x1", "x2"], outputCol="f2")
    sc.setJobGroup("transform", "transform")
    va_only.transform(train)
    assert jobs("transform") == 0
    sc.setJobGroup("fit", "fit")
    model = pipe.fit(train)
    n_fit_jobs = jobs("fit")
    assert n_fit_jobs > 0
    sc.setJobGroup("model_transform", "model_transform")
    pred = model.transform(test)
    assert jobs("model_transform") == 0
    print("jobs: transform 0, pipeline.fit", n_fit_jobs, ", model.transform 0")

    # Estimators become models, transformers stay as they are.
    kinds = [type(s) for s in model.stages]
    assert kinds == [StringIndexerModel, OneHotEncoderModel, VectorAssembler, LogisticRegressionModel], kinds
    assert isinstance(model, PipelineModel)
    assert pred.columns == ["x1", "x2", "c", "label", "c_idx", "c_vec", "features", "rawPrediction", "probability", "prediction"]
    plan = explain(pred)
    assert plan.count("UDF(") >= 3, "each stage is a Project with a JVM UDF"
    auc = BinaryClassificationEvaluator(metricName="areaUnderROC").evaluate(pred)
    assert auc > 0.95, auc
    print("test AUC:", round(auc, 3))
    for r in pred.orderBy("x1").limit(3).collect():
        print("sample row:", round(r.x1, 3), round(r.x2, 3), r.c, r.label, r.c_idx, r.c_vec, r.features, r.rawPrediction, r.probability, r.prediction)
    print("indexer order:", model.stages[0].labelsArray, "coefficients:", model.stages[-1].coefficients, round(model.stages[-1].intercept, 3))
    coef = model.stages[-1].coefficients.toArray()
    assert len(coef) == 4 and coef[0] > 0 > coef[1], coef  # x1 pushes towards 1, x2 away (as generated)

    # Cross validation: grid x folds fits (plus a refit of the best), and the cost shows in the job count.
    grid = ParamGridBuilder().addGrid(lr.regParam, [0.0, 0.1, 1.0]).addGrid(lr.maxIter, [5, 20]).build()
    assert len(grid) == 6
    cv = CrossValidator(estimator=pipe, estimatorParamMaps=grid, evaluator=BinaryClassificationEvaluator(), numFolds=3, seed=3, parallelism=2)
    sc.setJobGroup("cv", "cv")
    cv_model = cv.fit(train)
    assert len(cv_model.avgMetrics) == 6
    assert jobs("cv") > 6 * 3 * 3, jobs("cv")
    print("cross validation: 6 combinations x 3 folds,", jobs("cv"), "jobs, avg AUC", [round(float(a), 3) for a in cv_model.avgMetrics])

    # Persistence.
    root = tempfile.mkdtemp(prefix="ch12_")
    model.write().overwrite().save(root + "/m")
    assert sorted(os.listdir(root + "/m")) == ["metadata", "stages"]
    stage_dirs = sorted(os.listdir(root + "/m/stages"))
    assert [d.split("_")[1] for d in stage_dirs] == ["StringIndexer", "OneHotEncoder", "VectorAssembler", "LogisticRegression"], stage_dirs
    reloaded = PipelineModel.load(root + "/m")
    auc2 = BinaryClassificationEvaluator(metricName="areaUnderROC").evaluate(reloaded.transform(test))
    assert abs(auc - auc2) < 1e-9

    # Bad input stops VectorAssembler by default.
    try:
        VectorAssembler(inputCols=["x1", "x2"], outputCol="f").transform(
            spark.createDataFrame([(1.0, None)], "x1 double, x2 double")
        ).collect()
        raise AssertionError("a null must stop the default handleInvalid=error")
    except Exception as e:  # noqa: BLE001
        assert "FAILED_EXECUTE_UDF" in str(e) or "null" in str(e).lower()
    assert va.getOrDefault("handleInvalid") == "error"
    skipping = VectorAssembler(inputCols=["x1", "x2"], outputCol="f", handleInvalid="skip")
    assert skipping.transform(spark.createDataFrame([(1.0, None), (1.0, 2.0)], "x1 double, x2 double")).count() == 1

    spark.stop()
    print("ok")


if __name__ == "__main__":
    main()
