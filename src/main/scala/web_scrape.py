from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, ElementNotInteractableException, NoSuchElementException
import time

driver = webdriver.Safari()
driver.get("https://total-waterpolo.com/len-european-championships-2024-men/")

try:
    driver.maximize_window()
    # Wait for 20 seconds before performing the next actions
    time.sleep(10)
    # Handle cookie consent if it exists
    cookie_popup = driver.find_element_by_id("cookie_action_close_header")
    if cookie_popup.is_displayed():
        # Click the "ACCEPT" button to handle the cookie consent
        cookie_popup.click()

    # Loop for all games available
    match_links = driver.find_elements_by_class_name("match-link")[:2]

    # Iterate through each match link
    for match_link in match_links:
        try:
            # Click the match link
            match_link.click()
            time.sleep(10)
            # Perform actions (e.g., download stats)
            # Click the "STARTLIST" button
            startlist_button = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.ID, "nav-startlist-tab"))
            )
            startlist_button.click()

            # Scroll to the bottom of the page
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")

            # Wait for the "DOWNLOAD" button to be clickable at the bottom of the page
            download_button = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.ID, "btn_download_stats"))
            )

            # Click the "DOWNLOAD" button
            download_button.click()

            # Go back to the previous page
            driver.back()

        except NoSuchElementException:
            print("Element not found. Skipping to the next match link.")

        except TimeoutException:
            print("Timeout waiting for the button to be clickable.")
        except ElementNotInteractableException:
            print("Element is not interactable.")
        except Exception as e:
            print(f"An unexpected error occurred: {str(e)}")

finally:
    # Close the browser window
    driver.quit()
