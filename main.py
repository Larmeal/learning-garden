from spark_session import get_spark


def main():
    spark = get_spark("smoke")
    df = spark.createDataFrame([(1, "a"), (2, "b"), (3, "c")], ["id", "v"])
    df.filter(df.id > 1).show()
    print("count =", df.count(), "| spark", spark.version)
    spark.stop()


if __name__ == "__main__":
    main()
