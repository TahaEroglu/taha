import os
import json
import argparse
import joblib
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


DATA_DIR = "data"
ACTIVITY_FILE = os.path.join(DATA_DIR, "stepAndCalories.csv")
SLEEP_FILE = os.path.join(DATA_DIR, "sleepDay_merged.csv")
OUTPUT_DIR = "App_Data"
OUTPUT_MODEL = os.path.join(OUTPUT_DIR, "kmeans.zip")
OUTPUT_SCALER_JSON = os.path.join(OUTPUT_DIR, "kmeans_scaler.json")
OUTPUT_CENTROIDS_JSON = os.path.join(OUTPUT_DIR, "kmeans_centroids.json")


FEATURE_COLUMNS = [
    "TotalSteps",
    "TotalMinutesAsleep",
    "Calories",
]


def load_activity(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    if "ActivityDate" not in df.columns:
        raise ValueError("stepAndCalories.csv içinde 'ActivityDate' sütunu bulunamadı.")
    df["ActivityDate"] = pd.to_datetime(df["ActivityDate"]).dt.date
    return df


def load_sleep(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    if "SleepDay" not in df.columns:
        raise ValueError("sleepDay_merged.csv içinde 'SleepDay' sütunu bulunamadı.")
    df["SleepDay"] = pd.to_datetime(df["SleepDay"]).dt.date
    return df


def merge_datasets(activity: pd.DataFrame, sleep: pd.DataFrame) -> pd.DataFrame:
    merged = activity.merge(
        sleep.rename(columns={"SleepDay": "ActivityDate"}),
        on=["Id", "ActivityDate"],
        how="inner",
    )
    return merged


def build_pipeline(n_clusters: int) -> Pipeline:
    return Pipeline(
        steps=[
          ("scaler", StandardScaler()),
          ("kmeans", KMeans(n_clusters=n_clusters, random_state=42, n_init="auto")),
        ]
    )


def main(n_clusters: int = 4):
    if not os.path.exists(ACTIVITY_FILE):
        raise FileNotFoundError(f"Activity dosyası bulunamadı: {ACTIVITY_FILE}")
    if not os.path.exists(SLEEP_FILE):
        raise FileNotFoundError(f"Sleep dosyası bulunamadı: {SLEEP_FILE}")

    activity = load_activity(ACTIVITY_FILE)
    sleep = load_sleep(SLEEP_FILE)
    merged = merge_datasets(activity, sleep)

    if merged.empty:
        raise ValueError("Birleşmiş veri boş. Tarih formatlarını kontrol edin.")

    missing_cols = [c for c in FEATURE_COLUMNS if c not in merged.columns]
    if missing_cols:
        raise ValueError(f"Eksik sütunlar: {missing_cols}")

    features = merged[FEATURE_COLUMNS].fillna(0)
    pipeline = build_pipeline(n_clusters)
    pipeline.fit(features)

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    joblib.dump(pipeline, OUTPUT_MODEL, compress=3)

    # Export scaler params
    scaler: StandardScaler = pipeline.named_steps["scaler"]
    scaler_payload = {
        "feature_columns": FEATURE_COLUMNS,
        "mean": scaler.mean_.tolist(),
        "scale": scaler.scale_.tolist(),
    }
    with open(OUTPUT_SCALER_JSON, "w", encoding="utf-8") as f:
        json.dump(scaler_payload, f, ensure_ascii=False, indent=2)

    # Export centroids
    kmeans: KMeans = pipeline.named_steps["kmeans"]
    centroids_payload = {
        "feature_columns": FEATURE_COLUMNS,
        "k": kmeans.n_clusters,
        "centroids": kmeans.cluster_centers_.tolist(),
    }
    with open(OUTPUT_CENTROIDS_JSON, "w", encoding="utf-8") as f:
        json.dump(centroids_payload, f, ensure_ascii=False, indent=2)

    print(f"Model kaydedildi: {OUTPUT_MODEL}")
    print(f"Scaler JSON: {OUTPUT_SCALER_JSON}")
    print(f"Centroids JSON: {OUTPUT_CENTROIDS_JSON}")
    print(f"Küme sayısı: {n_clusters}")
    print(f"Eğitim örnek sayısı: {len(features)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="DailyActivity + SleepDay verisi ile K-Means eğitimi")
    parser.add_argument("--clusters", type=int, default=4, help="Küme sayısı (varsayılan: 4)")
    args = parser.parse_args()
    main(n_clusters=args.clusters)
