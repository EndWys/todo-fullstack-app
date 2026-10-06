using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TodoApp.Application.Features.Auth.Abstractions;
using TodoApp.Application.Features.Auth.Register;
using TodoApp.Infrastructure.Features.Auth.Persistence;
using TodoApp.Infrastructure.Features.Auth.Register;
using TodoApp.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

string connectionString = builder.Configuration.GetConnectionString("TodoApp")
                          ?? throw new InvalidOperationException(
                              "Connection string 'TodoApp' is not configured.");

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(connectionString));

builder.Services.AddScoped<IAuthRepository, AuthRepository>();
builder.Services.AddScoped<PasswordHasher<object>>();
builder.Services.AddScoped<IPasswordHasher, AspNetPasswordHasher>();
builder.Services.AddScoped<RegisterHandler>();

var app = builder.Build();

app.UseHttpsRedirection();

// ...

app.Run();