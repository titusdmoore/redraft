package main

import (
	"net/http"
	"os"

	"github.com/labstack/echo/v4"
)

func main() {
	e := echo.New()

	e.GET("/", func(c echo.Context) error {
		content, err := os.ReadFile("public/views/index.html")
		if err != nil {
			return err
		}

		return c.HTMLBlob(http.StatusOK, content)
	})
	e.Static("/assets", "public/assets")

	e.Logger.Fatal(e.Start(":1521"))
}
