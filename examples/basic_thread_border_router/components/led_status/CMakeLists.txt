idf_component_register(
    SRCS "led_status.c"
    INCLUDE_DIRS "include"
    REQUIRES openthread
    PRIV_REQUIRES esp_driver_ledc
)