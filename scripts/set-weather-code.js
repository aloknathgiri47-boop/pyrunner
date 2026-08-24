// Set the weather data code and run it
const code = `import numpy as np

def generate_weather_data():
    np.random.seed(7)

    days = np.arange(1, 31)

    temperature = np.random.normal(loc=30, scale=4, size=30)
    humidity = np.random.normal(loc=65, scale=10, size=30)
    rainfall = np.random.exponential(scale=4, size=30)

    temperature = np.round(temperature, 1)
    humidity = np.clip(np.round(humidity, 1), 30, 95)
    rainfall = np.round(rainfall, 1)

    return days, temperature, humidity, rainfall


def get_weather_summary(days, temperature, humidity, rainfall):
    hot_days = days[temperature >= 34]
    rainy_days = days[rainfall >= 5]

    return {
        "avg_temperature": round(float(np.mean(temperature)), 2),
        "max_temperature": float(np.max(temperature)),
        "min_temperature": float(np.min(temperature)),
        "avg_humidity": round(float(np.mean(humidity)), 2),
        "total_rainfall": round(float(np.sum(rainfall)), 2),
        "hot_days": hot_days.tolist(),
        "rainy_days": rainy_days.tolist(),
    }

# Run it
days, temperature, humidity, rainfall = generate_weather_data()
summary = get_weather_summary(days, temperature, humidity, rainfall)
print(summary)`

window.__projectStore.getState().setActiveFileContent(code)

// Click Run
const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Run'))
if (btn) btn.click()

'done'
