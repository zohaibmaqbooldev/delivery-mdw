if (window.location.hostname !== 'localhost') {
  await new Promise((resolve) => {
    const runtimeConfig = document.createElement('script')
    runtimeConfig.src = '/env-config.js'
    runtimeConfig.onload = resolve
    runtimeConfig.onerror = resolve
    document.head.appendChild(runtimeConfig)
  })
}

await import('./main.jsx')