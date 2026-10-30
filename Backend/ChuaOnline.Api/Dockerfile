FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["ChuaOnline.Api.csproj", "./"]
RUN dotnet restore "ChuaOnline.Api.csproj"
COPY . .
RUN dotnet publish "ChuaOnline.Api.csproj" -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "ChuaOnline.Api.dll"]
