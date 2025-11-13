# Real Estate Price Prediction

A comprehensive machine learning project that predicts property prices using advanced feature engineering and ensemble methods. This project demonstrates the transformative impact of strategic feature engineering on model performance.

![Price Prediction Interface](house_image.png)

## Key Features

- **Advanced Feature Engineering**: 17+ engineered features including interaction terms, mathematical transformations, and domain-specific metrics
- **Multiple Algorithm Comparison**: 7+ machine learning models evaluated with cross-validation
- **Performance Improvement**: 42.4% increase in R² score through feature engineering
- **Production-Ready**: Best model achieves R² = 0.9496 with interpretable feature importance

## Results

- **Baseline**: R² = 0.6652, RMSE = 1,300,896
- **Engineered**: R² = 0.9496, RMSE = 504,892
- **Best Model**: GradientBoosting Regressor
- **Key Features**: Price per sqft, luxury-area interactions, spatial metrics

## Tech Stack

Python, pandas, scikit-learn, XGBoost, LightGBM, matplotlib, seaborn
